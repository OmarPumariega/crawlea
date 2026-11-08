// Quién puede crear tokens del MCP. De momento solo el admin de la plataforma
// (uso propio). Abrirlo a los clientes es una decisión de producto pendiente
// (¿solo planes de pago? ¿el gasto sale de su bolsa de créditos? ya sale, pero
// hay que decidir cómo se presenta): cuando se decida, basta con ponerlo a false
// o sustituirlo por un moduleGate del plan.
export const MCP_ADMIN_ONLY = true;
