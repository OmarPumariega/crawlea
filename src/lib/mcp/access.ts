// Quién puede crear tokens del MCP. Decisión de producto: todas las cuentas
// activas tienen MCP. Es seguro porque cada herramienta ejecuta los handlers de
// la web con la identidad del dueño del token (aislamiento por propietario, gating
// por plan y guard de gasto/créditos de su cuenta). Si algún día se quiere limitar
// (p. ej. solo planes de pago), basta con ponerlo a true o añadir un moduleGate.
export const MCP_ADMIN_ONLY = false;
