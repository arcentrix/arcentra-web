/**
 * 通用分页组件
 * 统一所有页面的分页功能
 */

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DataTablePaginationProps {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页显示数量 */
  pageSize: number;
  /** 总记录数 */
  total: number;
  /** 页码变化回调 */
  onPageChange: (page: number) => void;
  /** 每页数量变化回调 */
  onPageSizeChange?: (pageSize: number) => void;
  /** 可选的每页数量选项 */
  pageSizeOptions?: number[];
  /** 是否显示每页数量选择器 */
  showPageSizeSelector?: boolean;
  /** 是否显示总数信息 */
  showTotal?: boolean;
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = false,
  showTotal = true,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // 生成页码数组
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      // 如果总页数小于等于 7，显示所有页码
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];

    if (page <= 3) {
      // 当前页在前 3 页
      pages.push(1, 2, 3, 4, "ellipsis", totalPages);
    } else if (page >= totalPages - 2) {
      // 当前页在后 3 页
      pages.push(
        1,
        "ellipsis",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      );
    } else {
      // 当前页在中间
      pages.push(
        1,
        "ellipsis",
        page - 1,
        page,
        page + 1,
        "ellipsis",
        totalPages,
      );
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  if (totalPages <= 1 && !showPageSizeSelector) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-2 py-4">
      {showTotal && (
        <div className="text-sm text-muted-foreground">
          Showing {start} to {end} of {total}
        </div>
      )}

      <div className="flex items-center gap-4">
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Rows per page:
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                onPageSizeChange(parseInt(value));
                onPageChange(1); // 改变每页数量时重置到第一页
              }}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) {
                      onPageChange(page - 1);
                    }
                  }}
                  className={
                    page === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {pageNumbers.map((pageNum, index) => {
                if (pageNum === "ellipsis") {
                  return (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        onPageChange(pageNum);
                      }}
                      isActive={page === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) {
                      onPageChange(page + 1);
                    }
                  }}
                  className={
                    page === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
