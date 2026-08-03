import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const SENIOR_ENDPOINT = 'http://187.109.234.22:8080/g5-senior-services/sapiens_SyncMCWFUsers';
const SENIOR_NS = 'http://services.senior.com.br';

function escapeXml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractText(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? m[1].trim() : '';
}

function extractAllBlocks(xml, tag) {
  const blocks = [];
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

async function listaUsuario() {
  const user = Deno.env.get('SENIOR_USER');
  const password = Deno.env.get('SENIOR_PASSWORD');
  if (!user || !password) {
    throw new Error('Credenciais Senior (SENIOR_USER/SENIOR_PASSWORD) não configuradas');
  }

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ListaUsuario xmlns="${SENIOR_NS}">
      <user>${escapeXml(user)}</user>
      <password>${escapeXml(password)}</password>
      <encryption>0</encryption>
      <parameters>
        <flowInstanceID></flowInstanceID>
        <flowName></flowName>
      </parameters>
    </ListaUsuario>
  </soap:Body>
</soap:Envelope>`;

  const resp = await fetch(SENIOR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
      'SOAPAction': '""',
      'User-Agent': 'Apache-HttpClient/4.5.13',
    },
    body: envelope,
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error('Senior respondeu HTTP ' + resp.status + ': ' + text.slice(0, 500));
  }

  // Check SOAP fault
  if (/<faultstring>/i.test(text)) {
    const fault = extractText(text, 'faultstring');
    throw new Error('Falha SOAP Senior: ' + (fault || 'erro desconhecido'));
  }

  const erroExecucao = extractText(text, 'erroExecucao');
  if (erroExecucao) {
    throw new Error('Erro de execução Senior: ' + erroExecucao);
  }

  const usuarios = extractAllBlocks(text, 'usuarios').map(block => ({
    ativo: extractText(block, 'ativo'),
    descricao: extractText(block, 'descricao'),
    email: extractText(block, 'email'),
    login: extractText(block, 'login'),
    nome: extractText(block, 'nome'),
  }));

  return usuarios;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usuarios = await listaUsuario();

    // Index Senior users by normalized email
    const seniorByEmail = {};
    for (const u of usuarios) {
      const email = (u.email || '').trim().toLowerCase();
      if (email) seniorByEmail[email] = u;
    }

    // Fetch all Base44 users (paginated via list)
    const b44Users = await base44.asServiceRole.entities.User.list('-created_date', 500);

    let updated = 0;
    let disabled = 0;
    let reactivated = 0;
    let skipped = 0;
    const missingInSenior = [];

    for (const b44 of b44Users) {
      const email = (b44.email || '').trim().toLowerCase();
      const senior = email ? seniorByEmail[email] : null;
      if (!senior) {
        skipped++;
        missingInSenior.push(b44.email || b44.full_name || b44.id);
        continue;
      }

      const shouldBeDisabled = !/^(s|sim|true|1)$/i.test((senior.ativo || '').trim());
      const changes = {};
      if (b44.disabled !== shouldBeDisabled) {
        changes.disabled = shouldBeDisabled;
      }
      if (senior.nome && senior.nome.trim() && b44.full_name !== senior.nome.trim()) {
        changes.full_name = senior.nome.trim();
      }

      if (Object.keys(changes).length > 0) {
        await base44.asServiceRole.entities.User.update(b44.id, changes);
        updated++;
        if (changes.disabled === true) disabled++;
        else if (changes.disabled === false) reactivated++;
      }
    }

    return Response.json({
      totalSenior: usuarios.length,
      totalBase44: b44Users.length,
      updated,
      disabled,
      reactivated,
      skipped,
      missingInSenior: missingInSenior.slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});