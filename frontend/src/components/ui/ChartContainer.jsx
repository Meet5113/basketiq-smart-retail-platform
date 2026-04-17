function ChartContainer({ children, className = '' }) {
  const resolvedClassName = ['h-80 min-h-[320px] w-full min-w-0', className].filter(Boolean).join(' ')

  return <div className={resolvedClassName}>{children}</div>
}

export default ChartContainer
