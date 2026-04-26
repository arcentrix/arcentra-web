import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Clock,
  Users2,
  ShieldCheck,
  ServerCog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IdentityConfigDialog } from '@/components/identity-config-dialog'
import { PlaceholderPanel } from '@/components/placeholder-panel'
import { toast } from '@/lib/toast'
import type {
  IdentityProvider,
  CreateIdentityProviderRequest,
  UpdateIdentityProviderRequest,
} from '@/api/identity/types'
import { Apis } from '@/api'

export default function IdentityPage() {
  const [providers, setProviders] = useState<IdentityProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<IdentityProvider | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [pageNum, setPageNum] = useState(1)
  const [pageSize] = useState(10)
  const [activeTab, setActiveTab] = useState<string>('providers')
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      loadProviders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProviders = async () => {
    setLoading(true)
    try {
      const list = await Apis.identity_integration.listIdentityProviders()
      setProviders(list.sort((a, b) => a.priority - b.priority))
    } catch (error) {
      toast.error('Failed to load providers')
      console.error('Load failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedProvider(null)
    setDialogOpen(true)
  }

  const handleEdit = async (provider: IdentityProvider) => {
    try {
      const fullProvider = await Apis.identity_integration.getIdentityProvider(provider.name)
      setSelectedProvider(fullProvider)
      setDialogOpen(true)
    } catch (error) {
      toast.error('Failed to load provider details')
      console.error('Load provider failed:', error)
    }
  }

  const handleSubmit = async (data: CreateIdentityProviderRequest) => {
    if (selectedProvider) {
      const updateData: UpdateIdentityProviderRequest = {
        name: data.name,
        provider_type: data.provider_type,
        config: data.config,
        description: data.description,
        priority: data.priority,
      }
      await Apis.identity_integration.updateIdentityProvider(selectedProvider.name, updateData)
    } else {
      await Apis.identity_integration.createIdentityProvider(data)
    }
    await loadProviders()
  }

  const handleDelete = async (name: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return

    try {
      await Apis.identity_integration.deleteIdentityProvider(name)
      toast.success('Provider deleted successfully')
      await loadProviders()
    } catch (error) {
      toast.error('Failed to delete provider')
      console.error('Delete failed:', error)
    }
  }

  const handleToggle = async (provider: IdentityProvider) => {
    try {
      await Apis.identity_integration.toggleIdentityProvider(
        provider.name,
        provider.isEnabled === 0,
      )
      toast.success(provider.isEnabled === 1 ? 'Provider disabled' : 'Provider enabled')
      await loadProviders()
    } catch (error) {
      toast.error('Failed to toggle provider status')
      console.error('Toggle failed:', error)
    }
  }

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (filterType !== 'all' && provider.providerType !== filterType) return false
      if (filterStatus === 'enabled' && provider.isEnabled !== 1) return false
      if (filterStatus === 'disabled' && provider.isEnabled !== 0) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return (
          provider.name.toLowerCase().includes(term) ||
          (provider.description && provider.description.toLowerCase().includes(term))
        )
      }
      return true
    })
  }, [providers, filterType, filterStatus, searchTerm])

  const totalPages = Math.ceil(filteredProviders.length / pageSize)
  const paginatedProviders = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize
    return filteredProviders.slice(startIndex, startIndex + pageSize)
  }, [filteredProviders, pageNum, pageSize])

  useEffect(() => {
    setPageNum(1)
  }, [searchTerm, filterType, filterStatus])

  const enabledCount = providers.filter((p) => p.isEnabled === 1).length
  const defaultProvider = providers.find((p) => p.isEnabled === 1)?.name || '—'

  const getProviderTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      oauth: { label: 'OAuth 2.0', className: 'bg-sky-50 text-sky-600 border border-sky-200' },
      ldap: { label: 'LDAP', className: 'bg-purple-50 text-purple-600 border border-purple-200' },
      oidc: {
        label: 'OIDC',
        className: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
      },
      saml: {
        label: 'SAML 2.0',
        className: 'bg-orange-50 text-orange-600 border border-orange-200',
      },
    }
    const variant = variants[type] || {
      label: type.toUpperCase(),
      className: 'bg-gray-100 text-gray-600 border border-gray-200',
    }
    return (
      <Badge variant='outline' className={variant.className}>
        {variant.label}
      </Badge>
    )
  }

  return (
    <>
      <section className='flex flex-1 flex-col gap-6 p-4 md:p-8 pt-6'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h2 className='flex items-center gap-3 text-3xl font-bold tracking-tight'>
              <Shield className='h-8 w-8 text-indigo-500' />
              Identity
            </h2>
            <p className='mt-1 text-muted-foreground'>
              Manage authentication, SSO and identity providers for the workspace.
            </p>
          </div>
          {activeTab === 'providers' && (
            <Button onClick={handleCreate}>
              <Plus className='mr-2 h-4 w-4' />
              Add Provider
            </Button>
          )}
        </div>

        {/* Top overview cards */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Enabled Providers</CardTitle>
              <ShieldCheck className='h-4 w-4 text-emerald-500' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{enabledCount}</div>
              <p className='text-xs text-muted-foreground'>
                {providers.length} configured · {providers.length - enabledCount} disabled
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Default Provider</CardTitle>
              <KeyRound className='h-4 w-4 text-sky-500' />
            </CardHeader>
            <CardContent>
              <div className='truncate text-2xl font-bold'>{defaultProvider}</div>
              <p className='text-xs text-muted-foreground'>Highest-priority enabled provider</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Login Policy</CardTitle>
              <Users2 className='h-4 w-4 text-violet-500' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>SSO optional</div>
              <p className='text-xs text-muted-foreground'>Default workspace policy</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
          <TabsList>
            <TabsTrigger value='providers'>Providers</TabsTrigger>
            <TabsTrigger value='login-policy'>Login Policy</TabsTrigger>
            <TabsTrigger value='session'>Session</TabsTrigger>
            <TabsTrigger value='scim-ldap'>SCIM / LDAP</TabsTrigger>
          </TabsList>

          <TabsContent value='providers' className='mt-6 space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle className='flex items-center gap-2'>
                      <Shield className='h-5 w-5' />
                      Identity Providers
                    </CardTitle>
                    <CardDescription>
                      Configure and manage supported identity providers (OAuth, LDAP, OIDC, SAML)
                    </CardDescription>
                  </div>
                </div>

                {/* Filters */}
                <div className='mt-4 flex gap-4'>
                  <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground' />
                    <Input
                      placeholder='Search by name or description...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className='pl-10'
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className='w-[180px]'>
                      <SelectValue placeholder='Filter by type' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Types</SelectItem>
                      <SelectItem value='oauth'>OAuth 2.0</SelectItem>
                      <SelectItem value='ldap'>LDAP</SelectItem>
                      <SelectItem value='oidc'>OpenID Connect</SelectItem>
                      <SelectItem value='saml'>SAML 2.0</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className='w-[150px]'>
                      <SelectValue placeholder='Filter by status' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Status</SelectItem>
                      <SelectItem value='enabled'>Enabled</SelectItem>
                      <SelectItem value='disabled'>Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className='flex items-center justify-center py-8'>
                    <p className='text-muted-foreground'>Loading...</p>
                  </div>
                ) : filteredProviders.length === 0 ? (
                  <div className='flex flex-col items-center justify-center py-12'>
                    <Shield className='mb-4 h-12 w-12 text-muted-foreground' />
                    <p className='mb-4 text-muted-foreground'>
                      {providers.length === 0
                        ? 'No identity providers configured'
                        : 'No providers match your filters'}
                    </p>
                    {providers.length === 0 ? (
                      <Button onClick={handleCreate}>
                        <Plus className='mr-2 h-4 w-4' />
                        Add Your First Provider
                      </Button>
                    ) : (
                      <Button
                        variant='outline'
                        onClick={() => {
                          setSearchTerm('')
                          setFilterType('all')
                          setFilterStatus('all')
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedProviders.map((provider) => (
                          <TableRow key={provider.id}>
                            <TableCell className='font-medium'>{provider.name}</TableCell>
                            <TableCell>{getProviderTypeBadge(provider.providerType)}</TableCell>
                            <TableCell>
                              <Badge
                                variant='outline'
                                className='border border-gray-200 bg-gray-50 text-gray-500'
                              >
                                {provider.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {provider.isEnabled === 1 ? (
                                <Badge
                                  variant='outline'
                                  className='border border-emerald-200 bg-emerald-50 text-emerald-600'
                                >
                                  <Power className='mr-1 h-3 w-3' />
                                  Enabled
                                </Badge>
                              ) : (
                                <Badge
                                  variant='outline'
                                  className='border border-gray-200 bg-gray-100 text-gray-500'
                                >
                                  <PowerOff className='mr-1 h-3 w-3' />
                                  Disabled
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className='max-w-xs truncate'>
                              {provider.description || '-'}
                            </TableCell>
                            <TableCell className='text-right'>
                              <div className='flex items-center justify-end gap-2'>
                                <Button
                                  size='sm'
                                  variant='ghost'
                                  onClick={() => handleToggle(provider)}
                                >
                                  {provider.isEnabled === 1 ? (
                                    <PowerOff className='h-4 w-4' />
                                  ) : (
                                    <Power className='h-4 w-4' />
                                  )}
                                </Button>
                                <Button
                                  size='sm'
                                  variant='ghost'
                                  onClick={() => handleEdit(provider)}
                                >
                                  <Edit className='h-4 w-4' />
                                </Button>
                                <Button
                                  size='sm'
                                  variant='ghost'
                                  onClick={() => handleDelete(provider.name)}
                                  className='text-red-500 hover:text-red-700'
                                >
                                  <Trash2 className='h-4 w-4' />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {totalPages > 1 && (
                      <div className='mt-4 flex items-center justify-between border-t pt-4'>
                        <div className='text-sm text-muted-foreground'>
                          Showing {(pageNum - 1) * pageSize + 1} to{' '}
                          {Math.min(pageNum * pageSize, filteredProviders.length)} of{' '}
                          {filteredProviders.length} providers
                        </div>
                        <div className='flex items-center gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                            disabled={pageNum === 1}
                          >
                            <ChevronLeft className='mr-1 h-4 w-4' />
                            Previous
                          </Button>
                          <div className='text-sm'>
                            Page {pageNum} of {totalPages}
                          </div>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                            disabled={pageNum === totalPages}
                          >
                            Next
                            <ChevronRight className='ml-1 h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='login-policy' className='mt-6'>
            <PlaceholderPanel
              icon={ShieldCheck}
              title='Login Policy'
              description='Require MFA, restrict allowed identity providers, enforce IP allowlists and break-glass overrides. API not yet available.'
            />
          </TabsContent>

          <TabsContent value='session' className='mt-6'>
            <PlaceholderPanel
              icon={Clock}
              title='Session'
              description='Configure session lifetime, idle timeout and refresh token rotation. API not yet available.'
            />
          </TabsContent>

          <TabsContent value='scim-ldap' className='mt-6'>
            <PlaceholderPanel
              icon={ServerCog}
              title='SCIM / LDAP sync'
              description='Provision users and groups from upstream directories. API not yet available.'
            />
          </TabsContent>
        </Tabs>
      </section>

      <IdentityConfigDialog
        key={selectedProvider?.id || 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={selectedProvider}
        onSubmit={handleSubmit}
      />
    </>
  )
}
