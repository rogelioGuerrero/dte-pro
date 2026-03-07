import React, { useEffect, useState } from 'react';
import { Users, Shield } from 'lucide-react';
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

export const TeamPanel: React.FC = () => {
  const { businessId, currentRole } = useEmisor();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

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
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            La gestión remota del equipo ya lee usuarios reales del backend. La invitación de usuarios se habilitará cuando confirmemos el endpoint de alta/invitación.
          </div>
        )}
      </div>
    </div>
  );
};
