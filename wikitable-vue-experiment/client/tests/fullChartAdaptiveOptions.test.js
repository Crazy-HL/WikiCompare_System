const assert = require("assert");
const {
  buildFullChartBarOption,
  buildFullChartLineOption,
} = require("../src/js/fullChartAdaptiveOptions");

const manyPoints = Array.from({ length: 18 }, (_, index) => ({
  label: `Category ${index + 1}`,
  year: 2000 + index,
  value: index + 1,
  display: String(index + 1),
}));

function visibleLabelCount(axisLabel, total) {
  const interval = axisLabel.interval;
  if (interval === 0) return total;
  return Array.from({ length: total }, (_, index) =>
    interval(index, `Category ${index + 1}`)
  ).filter(Boolean).length;
}

{
  const { option } = buildFullChartBarOption({ data: manyPoints, chartHeight: 360 });
  assert.deepStrictEqual(option.dataZoom, [], "bar chart should not render a horizontal slider");
  assert.strictEqual(typeof option.xAxis.axisLabel.interval, "function", "bar chart should throttle crowded x-axis labels");
  assert.ok(visibleLabelCount(option.xAxis.axisLabel, manyPoints.length) < manyPoints.length, "bar chart should not show every x-axis label when crowded");
}

{
  const { option } = buildFullChartLineOption({ data: manyPoints, chartHeight: 360 });
  assert.deepStrictEqual(option.dataZoom, [], "line chart should not render a horizontal slider");
  assert.strictEqual(typeof option.xAxis.axisLabel.interval, "function", "line chart should throttle crowded x-axis labels");
  assert.ok(visibleLabelCount(option.xAxis.axisLabel, manyPoints.length) < manyPoints.length, "line chart should not show every x-axis label when crowded");
}

console.log("fullChartAdaptiveOptions crowded x-axis regression checks passed");
