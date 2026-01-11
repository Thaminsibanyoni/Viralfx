import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

/**
 * Decorator to check if user has specific CRM permission
 * @param permission - Permission string (e.g., 'crm.brokers.approve')
 */
export const CheckPermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
