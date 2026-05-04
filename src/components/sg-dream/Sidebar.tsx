/**
 * SG DREAM AppShell sidebar. 248px sticky-left column with:
 *   - Schedio logo + product label
 *   - Active-entity picker button (links to /clients)
 *   - Workspace nav (Dashboard, Verifications, Submit, Library, Contracts)
 *   - Administration nav (Users & access, Audit log)
 *   - User footer (initials, name, role)
 *
 * Active state and live count badges are driven by props so the AppShell
 * can compute them once per render.
 */

import { Link } from '@tanstack/react-router'
import {
  ChevronsUpDown,
  ClipboardList,
  FileSpreadsheet,
  FileStack,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Client, User, Verification, Workflow } from '#/lib/sg-dream'
import { workflowConfigs } from '#/lib/sg-dream'
import type { SidebarCounts } from '#/lib/session'

type ActiveSection =
  | 'dashboard'
  | 'verifications'
  | 'submit'
  | 'library'
  | 'contracts'
  | 'users'
  | 'audit'

type SidebarProps = {
  client: Client
  user: User
  activeVerification: Verification
  workflow: Workflow
  active: ActiveSection
  counts: SidebarCounts
}

type NavItem = {
  id: ActiveSection
  label: string
  icon: LucideIcon
  count?: number
  to: string
  preserveVerification?: boolean
}

export function Sidebar({
  client,
  user,
  activeVerification,
  workflow,
  active,
  counts,
}: SidebarProps) {
  const config = workflowConfigs[workflow]
  const baseSearch = {
    client: client.id,
    verification: activeVerification.id,
  }

  const workspace: ReadonlyArray<NavItem> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      to: '/dashboard',
      count: counts.dashboard,
      preserveVerification: true,
    },
    {
      id: 'verifications',
      label: 'Verifications',
      icon: ClipboardList,
      to: '/verifications',
      count: counts.verifications,
    },
    {
      id: 'submit',
      label: 'Submit Documents',
      icon: UploadCloud,
      to: '/upload',
      count: counts.submit,
      preserveVerification: true,
    },
    {
      id: 'library',
      label: 'Document library',
      icon: FileStack,
      to: '/library',
      count: counts.library,
      preserveVerification: true,
    },
    {
      id: 'contracts',
      label: 'Contract tracking',
      icon: FileSpreadsheet,
      to: '/contracts',
      count: counts.contracts,
    },
  ]

  const admin: ReadonlyArray<NavItem> = [
    {
      id: 'users',
      label: 'Users & access',
      icon: Users,
      to: '/users',
      count: counts.users,
    },
    {
      id: 'audit',
      label: 'Audit log',
      icon: History,
      to: '/audit',
      count: counts.audit,
    },
  ]

  return (
    <aside className="nav-side" data-workflow={workflow}>
      <div className="brand-row">
        <div className="brand-mark">
          <img
            src="/schedio-logo.svg"
            alt="Schedio Group"
            className="brand-logo"
          />
          <div className="sub">SG DREAM</div>
        </div>
      </div>

      <div className="entity-block">
        <div className="label">Active entity</div>
        <Link
          to="/clients"
          search={{ selected: client.id }}
          className="entity-picker"
          aria-label={`Switch entity (currently ${client.name})`}
        >
          <span className="ebadge" aria-hidden>
            {client.code}
          </span>
          <span className="min-w-0 flex-1">
            <span className="ename block truncate">{client.name}</span>
            <span className="ewf">{config.shortLabel}</span>
          </span>
          <ChevronsUpDown
            className="size-4 text-muted-2"
            aria-hidden
          />
        </Link>
      </div>

      <NavSection
        title="Workspace"
        items={workspace}
        active={active}
        baseSearch={baseSearch}
      />
      <NavSection
        title="Administration"
        items={admin}
        active={active}
        baseSearch={baseSearch}
      />

      <div className="nav-foot">
        <div className="avatar" aria-hidden>
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="nm truncate">{user.name}</div>
          <div className="rl">Entity Owner</div>
        </div>
        <Link
          to="/login"
          search={{ error: undefined }}
          className="icon-btn"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </Link>
      </div>
    </aside>
  )
}

function NavSection({
  title,
  items,
  active,
  baseSearch,
}: {
  title: string
  items: ReadonlyArray<NavItem>
  active: ActiveSection
  baseSearch: { client: string; verification: string }
}) {
  return (
    <nav className="nav-section">
      <h6>{title}</h6>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.id === active
        const className = `nav-link${isActive ? ' active' : ''}`
        const count =
          typeof item.count === 'number' && item.count > 0
            ? item.count.toLocaleString('en-US')
            : null
        const inner = (
          <>
            <Icon aria-hidden />
            <span className="truncate">{item.label}</span>
            {item.id === 'audit' ? (
              <ShieldCheck
                aria-hidden
                className="ml-auto size-3.5 text-muted-2"
              />
            ) : null}
            {count ? (
              <span className={item.id === 'audit' ? '' : 'count'}>
                {count}
              </span>
            ) : null}
          </>
        )
        return (
          <Link
            key={item.id}
            to={item.to as never}
            search={
              (item.preserveVerification
                ? baseSearch
                : { client: baseSearch.client }) as never
            }
            className={className}
          >
            {inner}
          </Link>
        )
      })}
    </nav>
  )
}

export type { ActiveSection }
