import { useState, useEffect } from 'react'
import type { FC } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
  Server,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Apis } from '@/api'

interface DashboardProps {}

const Dashboard: FC<DashboardProps> = () => {
  const [agentStats, setAgentStats] = useState<{ total: number; online: number; offline: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const loadAgentStatistics = async () => {
      try {
        const stats = await Apis.agent.getAgentStatistics()
        setAgentStats(stats)
      } catch (error) {
        console.error('Failed to load agent statistics:', error)
      } finally {
        setLoadingStats(false)
      }
    }

    loadAgentStatistics()
  }, [])
  return (
    <section className='flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8'>
            <div className='flex items-center justify-between'>
              <h2 className='text-3xl font-bold tracking-tight'>Dashboard</h2>
            </div>

            {/* 1. 总览卡片 - Pipeline 状态 */}
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Running</CardTitle>
                  <Play className='h-4 w-4 text-blue-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>12</div>
                  <p className='text-xs text-muted-foreground'>
                    <TrendingUp className='mr-1 inline h-3 w-3 text-green-500' />
                    +3 from last hour
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Success</CardTitle>
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>847</div>
                  <p className='text-xs text-muted-foreground'>94.2% success rate (24h)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Failed</CardTitle>
                  <XCircle className='h-4 w-4 text-red-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>52</div>
                  <p className='text-xs text-muted-foreground'>
                    <TrendingDown className='mr-1 inline h-3 w-3 text-red-500' />
                    +12 from yesterday
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Avg Duration</CardTitle>
                  <Clock className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>8m 42s</div>
                  <p className='text-xs text-muted-foreground'>-1m 20s from last week</p>
                </CardContent>
              </Card>
            </div>

            {/* 2. 效率指标卡片 */}
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Deploy Frequency</CardTitle>
                  <Zap className='h-4 w-4 text-yellow-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>47</div>
                  <p className='text-xs text-muted-foreground'>Deployments per day</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Lead Time</CardTitle>
                  <Activity className='h-4 w-4 text-purple-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>2.4h</div>
                  <p className='text-xs text-muted-foreground'>Commit to production</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>MTTR</CardTitle>
                  <RefreshCw className='h-4 w-4 text-orange-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>24m</div>
                  <p className='text-xs text-muted-foreground'>Mean time to recovery</p>
                </CardContent>
              </Card>
            </div>

            {/* 3. 系统健康指标 */}
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Agents Online</CardTitle>
                  <Server className='h-4 w-4 text-green-500' />
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <div className='space-y-2'>
                      <Skeleton className='h-7 w-20' />
                      <Skeleton className='h-4 w-32' />
                    </div>
                  ) : agentStats ? (
                    <>
                      <div className='text-2xl font-bold'>
                        {agentStats.online} / {agentStats.total}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {agentStats.total > 0
                          ? `${Math.round((agentStats.online / agentStats.total) * 100)}% capacity available`
                          : 'No agents'}
                      </p>
                    </>
                  ) : (
                    <div className='text-2xl font-bold'>--</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Queue Length</CardTitle>
                  <Pause className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>3</div>
                  <p className='text-xs text-muted-foreground'>Pipelines waiting</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Change Failure Rate</CardTitle>
                  <AlertCircle className='h-4 w-4 text-orange-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>5.8%</div>
                  <p className='text-xs text-muted-foreground'>Last 7 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Execution Delay</CardTitle>
                  <Clock className='h-4 w-4 text-blue-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>1.2s</div>
                  <p className='text-xs text-muted-foreground'>Avg trigger to start</p>
                </CardContent>
              </Card>
            </div>

            {/* 4. 最近执行的 Pipelines 和团队统计 */}
            <div className='grid gap-4 md:gap-8 lg:grid-cols-3'>
              {/* 最近 Pipelines 执行 */}
              <Card className='lg:col-span-2'>
                <CardHeader className='flex flex-row items-center'>
                  <div className='grid gap-2'>
                    <CardTitle>Recent Pipeline Executions</CardTitle>
                    <CardDescription>Latest 10 pipeline runs across all projects</CardDescription>
                  </div>
                  <Button asChild className='ml-auto gap-1' size='sm' variant='outline'>
                    <Link to='/projects'>
                      View All
                      <ArrowUpRight className='h-4 w-4' />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pipeline</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className='text-right'>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className='font-medium'>Build & Deploy</TableCell>
                        <TableCell>web-app</TableCell>
                        <TableCell>
                          <Badge variant='success'>
                            <CheckCircle2 className='mr-1 h-3 w-3' />
                            Success
                          </Badge>
                        </TableCell>
                        <TableCell>8m 32s</TableCell>
                        <TableCell className='text-right'>
                          <Button size='sm' variant='ghost'>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className='font-medium'>Test Suite</TableCell>
                        <TableCell>api-service</TableCell>
                        <TableCell>
                          <Badge variant='destructive'>
                            <XCircle className='mr-1 h-3 w-3' />
                            Failed
                          </Badge>
                        </TableCell>
                        <TableCell>4m 12s</TableCell>
                        <TableCell className='text-right'>
                          <Button size='sm' variant='ghost'>
                            <RefreshCw className='mr-1 h-3 w-3' />
                            Retry
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className='font-medium'>Docker Build</TableCell>
                        <TableCell>mobile-app</TableCell>
                        <TableCell>
                          <Badge variant='secondary'>
                            <Play className='mr-1 h-3 w-3' />
                            Running
                          </Badge>
                        </TableCell>
                        <TableCell>2m 45s</TableCell>
                        <TableCell className='text-right'>
                          <Button size='sm' variant='ghost'>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className='font-medium'>Integration Test</TableCell>
                        <TableCell>web-app</TableCell>
                        <TableCell>
                          <Badge variant='success'>
                            <CheckCircle2 className='mr-1 h-3 w-3' />
                            Success
                          </Badge>
                        </TableCell>
                        <TableCell>12m 08s</TableCell>
                        <TableCell className='text-right'>
                          <Button size='sm' variant='ghost'>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className='font-medium'>E2E Tests</TableCell>
                        <TableCell>web-app</TableCell>
                        <TableCell>
                          <Badge variant='warning'>
                            <Pause className='mr-1 h-3 w-3' />
                            Queued
                          </Badge>
                        </TableCell>
                        <TableCell>--</TableCell>
                        <TableCell className='text-right'>
                          <Button size='sm' variant='ghost'>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 项目/团队统计 */}
              <Card>
                <CardHeader>
                  <CardTitle>Projects Overview</CardTitle>
                  <CardDescription>Performance by project</CardDescription>
                </CardHeader>
                <CardContent className='grid gap-6'>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>web-app</p>
                      <p className='text-sm text-muted-foreground'>42 runs • 95.2% success</p>
                    </div>
                    <Badge variant='success'>
                      Healthy
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>api-service</p>
                      <p className='text-sm text-muted-foreground'>38 runs • 87.5% success</p>
                    </div>
                    <Badge variant='warning'>
                      Warning
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>mobile-app</p>
                      <p className='text-sm text-muted-foreground'>29 runs • 96.5% success</p>
                    </div>
                    <Badge variant='success'>
                      Healthy
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>data-pipeline</p>
                      <p className='text-sm text-muted-foreground'>15 runs • 73.3% success</p>
                    </div>
                    <Badge variant='critical'>
                      Critical
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>infrastructure</p>
                      <p className='text-sm text-muted-foreground'>8 runs • 100% success</p>
                    </div>
                    <Badge variant='success'>
                      Healthy
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
    </section>
  )
}

export default Dashboard
