/**
 * 재고[n] = 재고[n-1] + OEI입고 - 주간출고 + NCI
 */
export function calculateWeekInventory(previousInventory, week) {
  return (
    previousInventory +
    week.oeiInbound -
    week.weeklyOutbound +
    week.nci
  )
}

export function calculateInventorySeries(weeklyPlans, startingInventory) {
  let previous = startingInventory

  return weeklyPlans.map((week, index) => {
    const inventory = calculateWeekInventory(previous, week)
    const delta = inventory - previous
    const row = {
      ...week,
      weekIndex: index + 1,
      previousInventory: previous,
      inventory,
      delta,
    }
    previous = inventory
    return row
  })
}
