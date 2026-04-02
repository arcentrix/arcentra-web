/**
 * Projects 列表页面 - 显示所有项目，可以创建新项目
 */

import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { Frame, Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const Overview: FC = () => {
  // 示例项目数据
  const projects = [
    { id: '1', name: 'Project A', description: 'Main project for production', pipelines: 12, deployments: 5 },
    { id: '2', name: 'Project B', description: 'Secondary project for testing', pipelines: 8, deployments: 3 },
    { id: '3', name: 'Project C', description: 'Development project', pipelines: 5, deployments: 2 },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Frame className="h-8 w-8 text-blue-500" />
            Projects
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your projects and create new ones
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`} className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Frame className="h-5 w-5 text-blue-500" />
                  {project.name}
                </CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pipelines</span>
                    <span className="font-medium">{project.pipelines}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Deployments</span>
                    <span className="font-medium">{project.deployments}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">View Details</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Overview
