/**
 * Request/response shapes shared with the NestJS API.
 *
 * Kept in sync with the backend DTOs by hand — see CLAUDE.md. When a DTO
 * changes in `apps/api`, change it here in the same commit.
 */

/** `GET /health` */
export interface HealthResponse {
  readonly ok: true;
}
