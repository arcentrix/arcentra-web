import { type FC } from 'react'
import { Activity, BarChart3, FileText, GitMerge, ScrollText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlaceholderPanel } from '@/components/placeholder-panel'

const Observe: FC = () => {
  return (
    <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
      <div>
        <h2 className='flex items-center gap-3 text-3xl font-bold tracking-tight'>
          <Activity className='h-8 w-8 text-cyan-500' />
          Observe
        </h2>
        <p className='mt-1 text-muted-foreground'>
          Logs, metrics, traces and audit trails across the platform
        </p>
      </div>

      <Tabs defaultValue='logs' className='w-full'>
        <TabsList>
          <TabsTrigger value='logs'>Logs</TabsTrigger>
          <TabsTrigger value='metrics'>Metrics</TabsTrigger>
          <TabsTrigger value='traces'>Traces</TabsTrigger>
          <TabsTrigger value='audit'>Audit</TabsTrigger>
        </TabsList>

        <TabsContent value='logs'>
          <PlaceholderPanel
            icon={ScrollText}
            title='Centralized logs'
            description='Stream and search logs from every workload, agent, and pipeline.'
          />
        </TabsContent>
        <TabsContent value='metrics'>
          <PlaceholderPanel
            icon={BarChart3}
            title='Platform metrics'
            description='Throughput, latency, success rates and capacity will land here.'
          />
        </TabsContent>
        <TabsContent value='traces'>
          <PlaceholderPanel
            icon={GitMerge}
            title='Distributed traces'
            description='End-to-end traces of pipeline runs and agent executions.'
          />
        </TabsContent>
        <TabsContent value='audit'>
          <PlaceholderPanel
            icon={FileText}
            title='Audit trail'
            description='Sensitive operations are recorded here for compliance review.'
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Observe
