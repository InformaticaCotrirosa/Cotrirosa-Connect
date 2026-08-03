const escapeXml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Autentica no webservice Senior SyncMCWFUsers.AuthenticateJAAS.
 * Envia usuário/senha digitados em user/password, encryption=0.
 * Retorna pmLogged (0 = sucesso).
 */
export const authenticateExternalUser = async (user, password) => {
  const url = process.env.EXTERNAL_AUTH_URL;
  if (!url) {
    throw new Error('EXTERNAL_AUTH_URL não configurado');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://services.senior.com.br">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:AuthenticateJAAS>
      <user>${escapeXml(user)}</user>
      <password>${escapeXml(password)}</password>
      <encryption>0</encryption>
      <parameters>
        <pmUserName>${escapeXml(user)}</pmUserName>
        <pmUserPassword>${escapeXml(password)}</pmUserPassword>
        <pmEncrypted>0</pmEncrypted>
      </parameters>
    </ser:AuthenticateJAAS>
  </soapenv:Body>
</soapenv:Envelope>`;

  const headers = {
    'Content-Type': 'text/xml;charset=UTF-8',
    SOAPAction: 'AuthenticateJAAS'
  };

  // Credenciais técnicas opcionais para autenticação HTTP básica na API
  const serviceUser = process.env.EXTERNAL_AUTH_SERVICE_USER;
  const servicePassword = process.env.EXTERNAL_AUTH_SERVICE_PASSWORD;
  if (serviceUser && servicePassword) {
    headers.Authorization = `Basic ${Buffer.from(`${serviceUser}:${servicePassword}`).toString('base64')}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: xml
  });

  const text = await response.text();

  if (process.env.NODE_ENV !== 'production') {
    const snippet = text.slice(0, 1000).replace(/\s+/g, ' ');
    console.debug('[soapAuth] SOAP response snippet:', snippet);
  }

  if (!response.ok) {
    throw new Error(`Falha HTTP no SOAP (${response.status})`);
  }

  const erroMatch = text.match(/<erroExecucao(?![^>]*xsi:nil)[^>]*>([\s\S]*?)<\/erroExecucao>/i);
  if (erroMatch && erroMatch[1].trim()) {
    throw new Error(`Erro de execução SOAP: ${erroMatch[1].trim()}`);
  }

  // Resposta do Senior: <pmLogged>0</pmLogged> = ok
  const loggedMatch = text.match(/<pmLogged[^>]*>([\s\S]*?)<\/pmLogged>/i);

  if (!loggedMatch) {
    throw new Error('Resposta SOAP inesperada: ' + text.slice(0, 300));
  }

  const code = parseInt(loggedMatch[1].trim(), 10);
  if (Number.isNaN(code)) {
    throw new Error('Código de retorno SOAP inválido: ' + loggedMatch[1]);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[soapAuth] pmLogged:', code);
  }

  return code;
};
