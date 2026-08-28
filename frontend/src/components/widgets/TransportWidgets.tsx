import React, { useState, useEffect } from 'react';
import type { WidgetProps, RouteItem, MyRouteData } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { Bus, MapPin, Phone, User, Navigation, Loader2 } from 'lucide-react';

export const FleetOverview: React.FC<WidgetProps> = ({ dataSource }) => {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<RouteItem[]>(dataSource)
      .then((res) => {
        if (isMounted && Array.isArray(res)) setRoutes(res);
      })
      .catch((err) => console.error('Failed to load transport fleet', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Bus size={16} /></span>
            Transport Fleet Status
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading fleet overview...
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><Bus size={16} /></span>
          Active Fleet & Transport Routes
        </div>
        <span className="badge badge-success">{routes.length} Active Routes</span>
      </div>

      <div className="widget-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }}>
          {routes.map((route) => (
            <div
              key={route.id}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{route.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Vehicle: {route.vehicleRegistration} • Capacity: {route.studentCount}/{route.vehicleCapacity}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <User size={12} /> Driver: {route.driverName} ({route.driverPhone})
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                <span className="badge badge-primary">{route.status || 'Active'}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                >
                  <Navigation size={12} /> Live Track
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MyRoute: React.FC<WidgetProps> = ({ dataSource }) => {
  const [route, setRoute] = useState<MyRouteData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<MyRouteData>(dataSource)
      .then((res) => {
        if (isMounted) setRoute(res);
      })
      .catch((err) => console.error('Failed to load student route', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Bus size={16} /></span>
            My Bus Route
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading route details...
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Bus size={16} /></span>
            My Bus Route
          </div>
        </div>
        <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No transport route assigned to your profile.
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><Bus size={16} /></span>
          Assigned Transport Service
        </div>
        <span className="badge badge-info">Active Route</span>
      </div>

      <div className="widget-body">
        <div style={{ padding: '0.75rem', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {route.routeName}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Bus Reg: <strong style={{ color: 'var(--text-primary)' }}>{route.vehicleRegistration}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div className="stat-box">
            <span className="stat-label">Morning Pickup</span>
            <span className="stat-value" style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{route.pickupTime}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Afternoon Drop</span>
            <span className="stat-value" style={{ fontSize: '1.1rem', color: '#818cf8' }}>{route.dropTime}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={14} color="var(--primary-light)" />
            <span>Designated Stop: <strong>{route.stopName}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Phone size={14} color="#10b981" />
            <span>Driver Contact: <strong>{route.driverName}</strong> ({route.driverPhone})</span>
          </div>
        </div>
      </div>
    </div>
  );
};
