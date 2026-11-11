/** Profil administrateur renvoye par GET /auth/me. */
export interface AdminProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'admin';
}
