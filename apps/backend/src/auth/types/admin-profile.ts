/** Profil administrateur autorise, tel que renvoye au frontend. */
export interface AdminProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'admin';
}
