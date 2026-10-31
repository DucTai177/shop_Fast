export const REALTIME_ROOMS = {
  ORDER: (orderNumber: string) => `order:${orderNumber}`,
  USER: (userId: string) => `user:${userId}`,
  ADMIN: 'admin_room',
};

export const REALTIME_EVENTS = {
  // Client -> Server
  JOIN_ORDER: 'joinOrder',
  LEAVE_ORDER: 'leaveOrder',
  JOIN_ADMIN: 'joinAdmin',
  LEAVE_ADMIN: 'leaveAdmin',

  // Server -> Client
  ORDER_STATUS_UPDATED: 'order:statusUpdated',
  ORDER_CREATED: 'order:created',
  ROOM_JOINED: 'room:joined',
  ROOM_LEFT: 'room:left',
  AUTHENTICATED: 'authenticated',
} as const;
