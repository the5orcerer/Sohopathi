import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useSession } from '../context/SessionContext';
import { fetchWidgetData } from '../services/api';
import type { RouteItem } from '../types';
import { SearchBar, Badge, Button, Modal } from '../components/common';
import { Plus, User, MapPin, Navigation } from 'lucide-react';

export const TransportPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { hasPermission } = useSession();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const canManage = hasPermission('transport.manage');

  useEffect(() => {
    fetchWidgetData<RouteItem[]>('/api/transport/routes')
      .then((res) => {
        if (Array.isArray(res)) setRoutes(res);
      })
      .catch(console.error);
  }, []);

  const filteredRoutes = routes.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.vehicleRegistration && r.vehicleRegistration.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.driverName && r.driverName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ProtectedRoute requiredPermission="transport.read" onNavigateHome={onNavigateHome}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Transport Logistics & Fleet Tracking</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Live bus route operations, driver dispatching, and student transit allocations.
            </p>
          </div>

          {canManage && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowAddModal(true)}>
              Add Route / Vehicle
            </Button>
          )}
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <SearchBar
            placeholder="Search routes, driver, vehicle plate..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <Badge tone="info">{filteredRoutes.length} Active Routes</Badge>
        </div>

        {/* Routes Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredRoutes.map((route) => (
            <div key={route.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{route.name}</span>
                <Badge tone="success">{route.status || 'Active'}</Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <div>Registration: <strong style={{ color: 'var(--text-primary)' }}>{route.vehicleRegistration}</strong></div>
                <div>Capacity: <strong>{route.studentCount} / {route.vehicleCapacity}</strong> Passengers</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <User size={13} color="var(--primary-light)" />
                  <span>Driver: <strong style={{ color: 'var(--text-primary)' }}>{route.driverName}</strong> ({route.driverPhone})</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button variant="secondary" size="sm" icon={<MapPin size={13} />}>
                  View Stops
                </Button>
                <Button variant="primary" size="sm" icon={<Navigation size={13} />}>
                  Live GPS
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Route Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Transit Route"
          subtitle="Configure route name and vehicle assignment"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setShowAddModal(false)}>Create Route</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Route Name
              </label>
              <input
                type="text"
                placeholder="e.g. Route 104 — Dhanmondi Shuttle"
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};
