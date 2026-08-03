import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Building2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { UNITS } from '@/lib/constants';

export default function DepartmentsPage() {
  const { user } = useOutletContext();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', unit: '', description: '' });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.listDepartments({ limit: 1000 }),
    initialData: [],
  });

  const handleSave = async () => {
    if (!form.name || !form.unit) return;
    setSaving(true);
    await apiClient.createDepartment(form);
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    setSaving(false);
    setShowForm(false);
    setForm({ name: '', unit: '', description: '' });
  };

  const groupedByUnit = {};
  departments.forEach(d => {
    if (!groupedByUnit[d.unit]) groupedByUnit[d.unit] = [];
    groupedByUnit[d.unit].push(d);
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold">Departamentos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{departments.length} departamentos em {Object.keys(groupedByUnit).length} unidades</p>
        </div>
        {user?.role === 'admin' && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Novo Departamento
          </Button>
        )}
      </div>

      <div className="space-y-8">
        {Object.entries(UNITS).map(([unitKey, unitInfo]) => {
          const depts = groupedByUnit[unitKey] || [];
          if (depts.length === 0) return null;
          return (
            <div key={unitKey}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: unitInfo.color }} />
                <h2 className="text-sm font-heading font-semibold">{unitInfo.label}</h2>
                <Badge variant="secondary" className="text-[10px]">{depts.length}</Badge>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {depts.map((dept, i) => (
                  <motion.div key={dept.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="hover:shadow-md hover:border-primary/20 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: unitInfo.color + '15' }}>
                            <Building2 className="w-4 h-4" style={{ color: unitInfo.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{dept.name}</p>
                            {dept.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{dept.description}</p>
                            )}
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" /> {dept.member_count || 0} membros
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}

        {departments.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum departamento cadastrado</p>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Novo Departamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do departamento" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Unidade *</Label>
              <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(UNITS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.unit}>
              {saving ? 'Salvando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}