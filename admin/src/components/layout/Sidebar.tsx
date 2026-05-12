'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wrench,
  UserRound,
  Settings,
  LogOut,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Package,
  Car,
  ClipboardList,
  MessageCircle,
  HeadphonesIcon,
  Brain,
  Map,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleSidebarCollapse, closeMobileSidebar } from '@/store/uiSlice';
import { logout } from '@/store/authSlice';
import { useRouter } from 'next/navigation';

// ─── Nav config ───────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
      { icon: CalendarDays,    label: 'Bookings',   href: '/bookings'  },
      { icon: Users,           label: 'Providers',  href: '/providers' },
      { icon: Wrench,          label: 'Services',   href: '/services'  },
      { icon: Package,         label: 'Packages',   href: '/packages'  },
      { icon: Map,             label: 'Delivery Fees', href: '/delivery-fees' },
      { icon: UserRound,       label: 'Clients',    href: '/clients'   },
      { icon: Car,             label: 'Drivers',    href: '/drivers'   },
      { icon: MessageCircle,   label: 'Messages',    href: '/messages'     },
      { icon: MessageCircle,   label: 'Message Flows', href: '/greetings'  },
      { icon: Brain,           label: 'AI Personality', href: '/ai-personality'  },
      { icon: Map,             label: 'Client Locations', href: '/client-locations'  },
      { icon: HeadphonesIcon,  label: 'Human Agents', href: '/human-agents'  },
      { icon: Smartphone,      label: 'WhatsApp',      href: '/waha'         },
      { icon: ClipboardList,   label: 'Logs',         href: '/logs'          },
    ],
  },
];

// ─── WA Logo Icon ─────────────────────────────────────────────
function WAIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────
function NavItem({
  icon: Icon,
  label,
  href,
  collapsed,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  collapsed: boolean;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative group"
      style={{
        background: active ? 'var(--color-sidebar-item-active)' : 'transparent',
        color: active
          ? 'var(--color-sidebar-item-active-text)'
          : 'var(--color-sidebar-text)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--color-sidebar-item-hover)';
          e.currentTarget.style.color = 'var(--color-sidebar-text-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-sidebar-text)';
        }
      }}
    >
      <Icon size={18} className="flex-shrink-0" />
      {!collapsed && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}

      {/* Tooltip on collapsed */}
      {collapsed && (
        <span
          className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg"
          style={{
            background: 'var(--color-text-primary)',
            color: 'var(--color-card-bg)',
          }}
        >
          {label}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar Content ──────────────────────────────────────────
function SidebarContent({
  collapsed,
  onNavClick,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    dispatch(logout());
    router.push('/login');
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-sidebar-bg)' }}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 h-16 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}
        style={{ borderBottom: '1px solid var(--color-sidebar-border)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-sidebar-logo-bg)', color: '#fff' }}
        >
          <WAIcon size={18} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight text-white truncate">
              WA Booking
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--color-sidebar-section-label)' }}>
              Admin Panel
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p
                className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-sidebar-section-label)' }}
              >
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  collapsed={collapsed}
                  active={pathname === item.href || pathname.startsWith(item.href + '/')}
                  onClick={onNavClick}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Settings + Logout */}
      <div
        className="px-2 py-3 space-y-0.5 flex-shrink-0"
        style={{ borderTop: '1px solid var(--color-sidebar-border)' }}
      >
        <NavItem
          icon={Settings}
          label="Settings"
          href="/settings"
          collapsed={collapsed}
          active={pathname === '/settings'}
          onClick={onNavClick}
        />
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative group cursor-pointer"
          style={{ color: 'var(--color-sidebar-text)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-danger-bg)';
            e.currentTarget.style.color = 'var(--color-danger)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-sidebar-text)';
          }}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
          {collapsed && (
            <span
              className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg"
              style={{ background: 'var(--color-text-primary)', color: 'var(--color-card-bg)' }}
            >
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar (main export) ────────────────────────────────────
export default function Sidebar() {
  const dispatch = useAppDispatch();
  const { sidebarCollapsed, sidebarMobileOpen } = useAppSelector((s) => s.ui);

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-300"
        style={{ width: sidebarCollapsed ? '72px' : '256px' }}
      >
        <aside
          className="flex flex-col h-full overflow-hidden"
          style={{ borderRight: '1px solid var(--color-sidebar-border)' }}
        >
          <SidebarContent collapsed={sidebarCollapsed} />
        </aside>

        {/* Collapse toggle button — outside aside so overflow-hidden doesn't clip it */}
        <button
          onClick={() => dispatch(toggleSidebarCollapse())}
          className="absolute top-[72px] -right-3 z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-md cursor-pointer transition-colors"
          style={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Mobile/tablet: overlay sidebar */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => dispatch(closeMobileSidebar())}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden
          transition-transform duration-300
          ${sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent
          collapsed={false}
          onNavClick={() => dispatch(closeMobileSidebar())}
        />
      </aside>
    </>
  );
}
