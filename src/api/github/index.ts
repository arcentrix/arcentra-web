import { post } from '../client'

export interface CreateIssueRequest {
  title: string
  description: string
}

export interface CreateIssueResponse {
  issueUrl: string
  issueNumber: number
}

// 创建 GitHub Issue
function createIssue(data: CreateIssueRequest) {
  return post<CreateIssueResponse>('/issue/create', data)
}

export default {
  createIssue,
}

