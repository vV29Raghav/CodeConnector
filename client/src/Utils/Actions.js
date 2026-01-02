const ACTIONS = {
  JOIN: 'join',
  JOINED: 'joined',
  DISCONNECTED: 'disconnected',
  SYNC_CODE: 'sync_code',
  LEAVE: 'leave',
  CODE_CHANGE: 'code_change',
  LANGUAGE_CHANGE: 'language_change',
  SYNC_RUNNING: 'sync_running',
  SYNC_OUTPUT: 'sync_output',
  REQUEST_AUTHORITY: 'request_authority',
  AUTHORITY_CHANGED: 'authority_changed',
  ROOM_FULL: 'room_full',
  SAVE_ROOM: 'save_room',
  ROOM_SAVED: 'room_saved',
  ROOM_SAVE_ERROR: 'room_save_error',
  DELETE_ROOM: 'delete_room',
  ROOM_DELETED: 'room_deleted',
  GET_USER_ROOMS: 'get_user_rooms',
  USER_ROOMS_LIST: 'user_rooms_list',
};

module.exports = ACTIONS;