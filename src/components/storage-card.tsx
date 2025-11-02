export function StorageCard() {
  const usedGB = 79.2
  const totalGB = 100
  const percentage = (usedGB / totalGB) * 100

  return (
    <div className='rounded-lg border bg-card p-2.5 shadow-sm'>
      <div className='mb-1.5 text-xs font-medium text-card-foreground'>Running out of space?</div>
      <div className='mb-1.5 flex items-center justify-between text-xs text-muted-foreground'>
        <span>
          {usedGB} GB / {totalGB} GB used
        </span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className='h-full bg-primary transition-all'
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

