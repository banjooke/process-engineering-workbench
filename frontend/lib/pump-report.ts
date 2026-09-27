/** Only the duty calculation's frozen source state is authoritative for reports. */
export function requirePumpReportFluidConfig(
  result: { resolved_fluid_config?: unknown },
  context: string,
): Record<string, unknown> {
  const fluid = result.resolved_fluid_config;
  const fail = () => new Error(
    `${context}: the pump-sizing response is missing a valid resolved_fluid_config. ` +
    "Recalculate with an updated engineering service before downloading the report. " +
    "No report request was sent; fluid properties cannot be guessed.",
  );
  if (!fluid || typeof fluid !== "object" || Array.isArray(fluid)) throw fail();
  const config = fluid as Record<string, unknown>;
  if (config.phase_type !== "Liquid" || config.use_manual_properties !== true) throw fail();
  for (const field of ["density_kg_m3", "dynamic_viscosity_pa_s", "vapor_pressure_bar_a"]) {
    const value = config[field];
    if (typeof value !== "number" || !Number.isFinite(value) ||
        (field === "vapor_pressure_bar_a" ? value < 0 : value <= 0)) throw fail();
  }
  return config;
}
