export interface Musician {
  id: string;
  user_id: string;
  name: string;
  instrument: string;
  genre: string;
  city: string;
  description: string;
  avatar_url: string | null;
  contact_email: string | null;
  availability_days: string | null;
  availability_slots: string | null;
  level: string | null;
  experience: string | null;
  influences: string | null;
  spotify_url: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  soundcloud_url: string | null;
  created_at: string;
}

export interface Band {
  id: string;
  user_id: string;
  name: string;
  genre: string;
  city: string;
  description: string;
  avatar_url: string | null;
  members_count: number | null;
  looking_for: string | null;
  contact_email: string | null;
  spotify_url: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  created_at: string;
}

export interface Venue {
  id: string;
  user_id: string;
  name: string;
  city: string;
  address: string | null;
  description: string | null;
  avatar_url: string | null;
  capacity: number | null;
  genres: string | null;
  contact_email: string | null;
  instagram_url: string | null;
  website_url: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface Teacher {
  id: string;
  user_id: string;
  name: string;
  instrument: string;
  city: string;
  description: string | null;
  avatar_url: string | null;
  hourly_rate: number | null;
  experience_years: number | null;
  contact_email: string | null;
  level: string | null;
  experience: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  modality: string | null;
  created_at: string;
}

export interface RehearsalSpace {
  id: string;
  user_id: string;
  name: string;
  city: string;
  address: string | null;
  description: string | null;
  avatar_url: string | null;
  hourly_rate: number | null;
  rooms_count: number | null;
  capacity: number | null;
  equipment: string | null;
  contact_email: string | null;
  instagram_url: string | null;
  website_url: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface BandVacancy {
  id: string;
  band_id: string;
  instrument: string;
  description: string | null;
  genre: string | null;
  open: boolean;
  created_at: string;
}

export interface BandMember {
  id: string;
  band_id: string;
  name: string;
  instrument: string | null;
  created_at: string;
}

export type EventGenre = 'Rock' | 'Jazz' | 'Flamenco' | 'Electrónica' | 'Pop' | 'Metal' | 'Indie' | 'Blues' | 'Folk' | 'Otro';

export interface Event {
  id: string;
  user_id: string;
  title: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  genre: EventGenre;
  price: string;
  description: string | null;
  contact_email: string | null;
  ticket_url: string | null;
  created_at: string;
}

export type PostType =
  | 'musician_seeking_band'
  | 'band_seeking_musician'
  | 'event_announcement'
  | 'session_offer'
  | 'gear_sale'
  | 'looking_for_rehearsal'
  | 'collab'
  | 'other';

export interface Post {
  id: string;
  user_id: string;
  type: PostType;
  text: string;
  city: string | null;
  instrument: string | null;
  genre: string | null;
  author_name: string;
  author_profile_type: string | null;
  author_profile_id: string | null;
  created_at: string;
}

export type GearCondition = 'new' | 'like_new' | 'good' | 'acceptable';
export type GearStatus = 'active' | 'sold' | 'reserved';

export interface GearListing {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  condition: GearCondition | null;
  city: string | null;
  images: string[] | null;
  status: GearStatus;
  seller_name: string | null;
  seller_profile_type: string | null;
  seller_profile_id: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_name: string | null;
  user2_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  read: boolean;
  created_at: string;
}

export type NotificationType = 'message' | 'application' | 'rsvp' | 'review' | 'system' | 'favorite' | 'event_reminder' | 'booking';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  entity_type: 'venue' | 'teacher' | 'rehearsal';
  entity_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  author_name: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  role: string | null;
  created_at: string;
}
