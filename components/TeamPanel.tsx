import React, { useEffect, useState } from 'react';
import { Users, Shield, Mail } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { useEmisor } from '../contexts/EmisorContext';
import { normalizeRole, Role } from '../utils/roleAccess';
import { notify } from '../utils/notifications';

interface Member {
  email: string;
  role: Role;
  status?: string;
}

interface TeamUsersResponse {
  success: boolean;
  users: Array<{
    email: string;
    role: string | null;
  }>;
}

interface InviteResponse {
  success: boolean;
  invite: {
    businessId: string;
    email: string;
    role: string | null;
    status: string;
  };
}

export const TeamPanel: React.FC = () => {
  const { businessId, currentRole } = useEmisor();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('operator');

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await apiFetch<TeamUsersResponse>(`/api/business/businesses/${businessId}/users`);
      setMembers(
        data.users.map((m) => ({
          email: m.email,
          role: normalizeRole(m.role),
          status: 'active',
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
    if (!businessId || !inviteEmail.trim()) return;

    setInviting(true);
    try {
      const response = await apiFetch<InviteResponse>('/api/business/business_users/invite', {
        method: 'POST',
        body: {
          businessId,
          email: inviteEmail.trim(),
          role: inviteRole || 'operator',
        },
      });

      setMembers((current) => {
        const next = current.filter((item) => item.email !== response.invite.email);
        next.unshift({
          email: response.invite.email,
          role: normalizeRole(response.invite.role),
          status: response.invite.status,
        });
        return next;
      });

      setInviteEmail('');
      setInviteRole('operator');
      notify('Invitación enviada correctamente', 'success');
    } catch (err: any) {
      console.error(err);
      notify(err?.message || 'No se pudo enviar la invitación', 'error');
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
          ) : !businessId ? (
            <p className="text-sm text-gray-500">Selecciona un emisor para ver el equipo.</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500">No hay usuarios asociados.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.email} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.email}</p>
                    <p className="text-xs text-gray-500">Rol: {m.role || 'sin rol'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Shield className="w-4 h-4" />
                      {m.role || 'N/A'}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${m.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                      {m.status === 'pending' ? 'Invitación pendiente' : 'Activo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {canManage && (
          <form onSubmit={handleInvite} className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-indigo-900">Invitar usuario</h3>
              <p className="text-xs text-indigo-700 mt-1">Solo `owner` y `admin` pueden invitar usuarios a este negocio.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Correo</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@dominio.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Rol</label>
                <select
                  value={inviteRole || 'operator'}
                  onChange={(e) => setInviteRole(normalizeRole(e.target.value) || 'operator')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={inviting || !businessId}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                <Mail className="w-4 h-4" />
                {inviting ? 'Enviando...' : 'Enviar invitación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
