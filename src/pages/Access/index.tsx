/**
 * Access 访问控制页面 - 展示所有子菜单卡片
 */

import { Link } from "react-router-dom";
import {
  Shield,
  ChevronRight,
  Users,
  UserCog,
  UsersRound,
  Lock,
} from "lucide-react";

// 子菜单配置
const accessItems = [
  {
    title: "Users",
    url: "/users",
    description: "Manage user accounts and access control",
    icon: Users,
    color: "text-blue-500",
  },
  {
    title: "Roles",
    url: "/roles",
    description: "Configure user roles and permissions",
    icon: UserCog,
    color: "text-green-500",
  },
  {
    title: "Team",
    url: "#",
    description: "Manage your team members and permissions",
    icon: UsersRound,
    color: "text-purple-500",
  },
  {
    title: "Access Control",
    url: "#",
    description: "Configure access control policies and rules",
    icon: Lock,
    color: "text-orange-500",
  },
];

export default function AccessPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-500" />
            Access
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage user access, roles, and permissions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {accessItems.map((item) => (
          <Link key={item.url} to={item.url} className="group">
            <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-primary/50 cursor-pointer">
              <div className="flex items-start gap-4">
                <div className={`shrink-0 ${item.color}`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
