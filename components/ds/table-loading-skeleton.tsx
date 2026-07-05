import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type TableLoadingSkeletonProps = {
  rows?: number;
  columns?: number;
  showLeadingAvatar?: boolean;
};

export function TableLoadingSkeleton({
  rows = 6,
  columns = 3,
  showLeadingAvatar = false,
}: TableLoadingSkeletonProps) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <TableRow key={`table-loading-row-${rowIndex}`}>
      {Array.from({ length: columns }, (_, columnIndex) => (
        <TableCell key={`table-loading-cell-${rowIndex}-${columnIndex}`}>
          <div className="flex items-center gap-2">
            {showLeadingAvatar && columnIndex === 0 ? (
              <Skeleton className="h-8 w-8 rounded-full" />
            ) : null}
            <Skeleton className="h-4 w-full max-w-55" />
          </div>
        </TableCell>
      ))}
    </TableRow>
  ));
}
