import type { SaleStepStatus, SaleStepType } from '../models/SaleStep'

export function saleStatusLabel(status: string) {
  switch (status) {
    case 'lead':
      return 'Lead'
    case 'in_progress':
      return 'En progreso'
    case 'closed':
      return 'Cerrada'
    case 'archived':
      return 'Archivada'
    default:
      return status
  }
}

export function saleStepTypeLabel(type: SaleStepType) {
  switch (type) {
    case 'CONTRACT':
      return 'Contrato'
    case 'PAYMENT':
      return 'Pago'
    case 'DEVICE_CONFIG':
      return 'Configuración de dispositivos'
    case 'CREDENTIALS':
      return 'Credenciales'
    case 'SHIPPING':
      return 'Envío'
    case 'INSTALLATION':
      return 'Instalación'
    case 'REMOTE_SUPPORT':
      return 'Soporte remoto'
    default:
      return String(type)
  }
}

export function saleStepStatusLabel(status: SaleStepStatus | string) {
  switch (status) {
    case 'PENDING':
      return 'Pendiente'
    case 'IN_PROGRESS':
      return 'En curso'
    case 'SENT':
      return 'Enviado'
    case 'DONE':
      return 'Listo'
    case 'SIGNED':
      return 'Firmado'
    default:
      return String(status)
  }
}
