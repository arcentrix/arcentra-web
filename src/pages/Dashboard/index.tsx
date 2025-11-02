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
import { AppSidebar } from '@/components/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarLayout, SidebarTrigger } from '@/components/ui/sidebar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface DashboardProps {}

const Dashboard: FC<DashboardProps> = () => {
  return (
    <SidebarLayout defaultOpen>
      <AppSidebar />
      <main className='flex flex-1 flex-col p-2 transition-all duration-300 ease-in-out'>
        <div className='h-full rounded-md'>
          <div className='flex items-center justify-between p-4'>
            <SidebarTrigger />
          </div>
          <section className='flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8'>
            {/* 标题和操作按钮 */}
            <div className='flex items-center justify-between'>
              <h2 className='text-3xl font-bold tracking-tight'>Dashboard</h2>
              <Button>
                <Play className='mr-2 h-4 w-4' />
                Trigger Pipeline
              </Button>
            </div>

            {/* Tabs */}
            <Tabs className='w-full' defaultValue='overview'>
              <TabsList>
                <TabsTrigger value='overview'>Overview</TabsTrigger>
                <TabsTrigger value='efficiency'>Efficiency</TabsTrigger>
                <TabsTrigger value='quality'>Quality</TabsTrigger>
                <TabsTrigger value='teams'>Teams</TabsTrigger>
              </TabsList>
            </Tabs>

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
                  <div className='text-2xl font-bold'>8 / 10</div>
                  <p className='text-xs text-muted-foreground'>80% capacity available</p>
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
                    <a href='#'>
                      View All
                      <ArrowUpRight className='h-4 w-4' />
                    </a>
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
                          <Badge variant='default' className='bg-green-500'>
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
                          <Badge variant='default' className='bg-green-500'>
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
                          <Badge variant='outline' className='text-yellow-600 border-yellow-600'>
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
                    <Badge variant='default' className='bg-green-500'>
                      Healthy
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>api-service</p>
                      <p className='text-sm text-muted-foreground'>38 runs • 87.5% success</p>
                    </div>
                    <Badge variant='outline' className='text-yellow-600 border-yellow-600'>
                      Warning
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>mobile-app</p>
                      <p className='text-sm text-muted-foreground'>29 runs • 96.5% success</p>
                    </div>
                    <Badge variant='default' className='bg-green-500'>
                      Healthy
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>data-pipeline</p>
                      <p className='text-sm text-muted-foreground'>15 runs • 73.3% success</p>
                    </div>
                    <Badge variant='destructive'>Critical</Badge>
                  </div>
                  <div className='flex items-center justify-between space-x-4'>
                    <div className='flex-1 space-y-1'>
                      <p className='text-sm font-medium leading-none'>infrastructure</p>
                      <p className='text-sm text-muted-foreground'>8 runs • 100% success</p>
                    </div>
                    <Badge variant='default' className='bg-green-500'>
                      Healthy
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </SidebarLayout>
  )
}

export default Dashboard
