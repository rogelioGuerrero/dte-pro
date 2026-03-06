import React, { useEffect, useState } from 'react';
import { Users, Mail, Shield } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { useEmisor } from '../contexts/EmisorContext';
import { normalizeRole, Role } from '../utils/roleAccess';
import { notify } from '../utils/notifications';

interface Member {
  email: string;
  role: Role;
  status?: string;
}

export const TeamPanel: React.FC = () => {
  const { businessId, currentRole } = useEmisor();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('operator');

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await apiFetch<Member[]>(`/api/business/businesses/${businessId}/users`);
      setMembers(
        data.map((m) => ({
          email: m.email,
          role: normalizeRole(m.role),
          status: m.status,
        }))
      );
    } catch (err: any) {
      console.error(err);
      notify('No se pudo cargar el equipo', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setInviting(true);
    try {
      await apiFetch('/api/business/business_users/invite', {
        method: 'POST',
        body: { businessId, email: email.trim(), role },
      });
      notify('Invitación enviada', 'success');
      setEmail('');
      setRole('operator');
      load();
    } catch (err: any) {
      console.error(err);
      notify(err?.message || 'No se pudo invitar', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">Equipo</h2>
        </div>
        {!canManage && <span className="text-xs text-gray-500">Solo lectura (rol {currentRole || 'sin rol'})</span>}
      </div>
      <div className="p-6 space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Usuarios asociados</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500">No hay usuarios asociados.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.email} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.email}</p>
                    <p className="text-xs text-gray-500">Rol: {m.role || 'sin rol'} {m.status ? `· ${m.status}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Shield className="w-4 h-4" />
                    {m.role || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canManage && (
          <form className="space-y-4" onSubmit={handleInvite}>
            <h3 className="text-sm font-semibold text-gray-800">Invitar usuario</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-600">Correo</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="usuario@dominio.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Rol</label>
                <select
                  value={role || 'operator'}
                  onChange={(e) => setRole(normalizeRole(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              <Mail className="w-4 h-4" />
              {inviting ? 'Enviando...' : 'Enviar invitación'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
