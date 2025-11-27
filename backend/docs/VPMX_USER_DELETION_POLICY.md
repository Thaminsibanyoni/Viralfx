# User Deletion and VPMX Data Preservation Policy

## Overview

This document outlines the implementation of soft delete mechanisms for user accounts and the preservation of VPMX (Viral Popularity Market Index) historical data. The implementation ensures that audit trails, market integrity, and historical fairness data are maintained when users are deleted from the system.

## Problem Statement

Prior to this implementation, user deletion would cascade delete related VPMX exposure and fairness records through database foreign key constraints with `onDelete: Cascade`. This resulted in:

- Loss of historical exposure data for audit purposes
- Removal of user fairness metrics needed for market integrity analysis
- Breaks in historical market data and betting patterns
- Inability to analyze long-term user behavior patterns

## Solution Architecture

### 1. Soft Delete Implementation

#### User Model Updates
The User model now includes comprehensive soft delete support:

```prisma
model User {
  // ... existing fields ...

  // Soft delete fields for preserving VPMX historical data
  isDeleted     Boolean   @default(false) @map("is_deleted")
  deletedAt     DateTime? @map("deleted_at")

  // Additional status fields for user management
  isActive      Boolean   @default(true) @map("is_active")
  isVerified    Boolean   @default(false) @map("is_verified")
  suspensionReason String? @map("suspension_reason")
  suspendedAt   DateTime? @map("suspended_at")

  // ... rest of model ...
}
```

#### VPMX Models Updates

**VpmxExposure Model:**
- Removed `onDelete: Cascade` from User relation
- Added `deletedAt DateTime?` field for soft delete support
- Added index on `deletedAt` for efficient querying

**VPMXUserFairness Model:**
- Removed `onDelete: Cascade` from User relation
- Added `deletedAt DateTime?` field for soft delete support
- Added index on `deletedAt` for efficient querying

### 2. User Deletion Process

The `UsersService.deleteUser()` method now performs a comprehensive soft delete operation:

```typescript
@AuditLog('DELETE_USER')
async deleteUser(userId: string): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Soft delete the user account
    await tx.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        status: 'DELETED',
      },
    });

    // Preserve VPMX historical data by soft deleting related records
    await tx.vpmxExposure.updateMany({
      where: { userId },
      data: {
        deletedAt: new Date(),
        status: 'CLOSED', // Close active exposures
      },
    });

    await tx.vPMXUserFairness.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    // Close any active VPMX bets to maintain market integrity
    await tx.vPMXBet.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'REFUNDED' },
    });
  });
}
```

### 3. VPMX Service Updates

#### UserFairnessService Changes

All queries in `UserFairnessService` now exclude soft-deleted records:

```typescript
// Example updated query
const userFairness = await this.prisma.vPMXUserFairness.findFirst({
  where: {
    userId,
    deletedAt: null // Exclude soft-deleted fairness records
  },
});
```

Updated methods include:
- `getUserFairnessMetrics()`
- `getUnusualUsers()`
- `performFairnessAssessment()`
- `getUserRestriction()`
- `reassessUserFairness()`

## Benefits of This Implementation

### 1. Audit Trail Preservation
- All VPMX exposure data is preserved for compliance and auditing
- Historical user fairness metrics remain available for analysis
- Complete betting history is maintained for market integrity

### 2. Market Integrity
- No disruption to historical market data analysis
- Fairness algorithms can continue to access historical patterns
- Whale detection and unusual pattern analysis remains accurate

### 3. Compliance and Analytics
- Meets data retention requirements for financial trading platforms
- Enables long-term behavioral analysis
- Supports regulatory audits and investigations

### 4. Performance Optimizations
- Added database indexes on `deletedAt` fields for efficient querying
- Soft-deleted records are excluded from active queries
- Cache invalidation properly handles soft deletes

## Query Patterns for Data Access

### Active Users (Default)
All standard user queries should exclude soft-deleted records:

```typescript
// Standard pattern for querying active users
where: {
  isDeleted: false,
  // ... other conditions
}
```

### Historical Analysis
For audit and analysis purposes, include soft-deleted records:

```typescript
// Pattern for historical analysis
where: {
  // No isDeleted filter to include all records
  deletedAt: { gte: startDate } // Optional time filtering
}
```

### VPMX Data Access
Active VPMX data queries exclude soft-deleted records:

```typescript
// VPMX exposure queries
where: {
  userId,
  deletedAt: null,
  status: 'ACTIVE'
}

// VPMX fairness queries
where: {
  userId,
  deletedAt: null
}
```

## Data Retention Policy

### VPMX Historical Data
- **Preservation Period**: Indefinite (or as defined by regulatory requirements)
- **Access Level**: Read-only for deleted users
- **Purpose**: Audit, compliance, market analysis

### User Personal Data
- **Account Information**: Soft deleted, accessible for audit only
- **Personal Identifiers**: Soft deleted with account
- **Transaction History**: Preserved for regulatory compliance

## Database Migration Requirements

When deploying these changes, the following migration steps are required:

1. **Add new fields** to User, VpmxExposure, and VPMXUserFairness models
2. **Remove cascade delete** constraints from VPMX relations
3. **Create indexes** on new `deletedAt` fields
4. **Update existing soft-deleted users** to have proper `deletedAt` timestamps
5. **Regenerate Prisma client** with updated schema

## Monitoring and Maintenance

### Performance Monitoring
- Monitor query performance on VPMX tables with new soft delete filters
- Track cache hit rates for user and VPMX data
- Database index usage optimization

### Data Integrity
- Regular audits to ensure VPMX data consistency
- Validate that soft-deleted user data remains accessible for analysis
- Monitor for any hard delete operations that might bypass soft delete

### Compliance Reporting
- Generate regular reports on user deletion activities
- Maintain audit trails for VPMX data preservation
- Support regulatory data retention requirements

## Security Considerations

### Access Control
- Soft-deleted user data should only be accessible to authorized personnel
- Implement role-based access for historical VPMX data viewing
- Audit all access to deleted user information

### Data Privacy
- Ensure compliance with data protection regulations (GDPR, CCPA, etc.)
- Implement data anonymization where required for long-term storage
- Provide mechanisms for data export or permanent deletion when legally required

## Future Enhancements

### Potential Improvements
1. **Automated Data Archiving**: Move old soft-deleted records to archival storage
2. **Data Anonymization**: Automatically anonymize personal data after retention period
3. **Advanced Analytics**: Implement specialized tools for analyzing deleted user patterns
4. **Compliance Automation**: Automated reporting for regulatory requirements

### Hard Delete Mechanisms
For cases where permanent deletion is legally required:

```typescript
// Example hard delete with proper authorization
async permanentDeleteUser(userId: string, authContext: AuthorizationContext): Promise<void> {
  // Implement proper authorization and logging
  // Archive necessary data before permanent deletion
  // Ensure all legal requirements are met
}
```

## Conclusion

This implementation successfully addresses the cascade delete issue while maintaining data integrity, market stability, and regulatory compliance. The soft delete approach ensures that VPMX historical data remains available for analysis and audit purposes while effectively removing users from the active system.

The solution provides a robust foundation for user lifecycle management while preserving the critical VPMX data necessary for market operations and compliance requirements.