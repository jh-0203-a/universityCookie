// ============================================================
// 앱에서 다루는 데이터의 "모양"(타입)을 정의하는 파일입니다.
// 글, 사용자, 모임, 중고상품, 채팅, 문의 각각의 항목이 어떤
// 값을 가지는지 여기서 한눈에 볼 수 있어요.
// ============================================================

// 게시판 이름 (기본 게시판 + 사용자가 만든 게시판이라 자유 문자열)
export type BoardType = string;

// 기본(항상 보이는) 게시판들. '전체'는 코드에서 null 로 따로 처리합니다.
//  - 학교별: 대학 인증🎓 회원만, 같은 권역끼리   /   지역별: 지역 인증📍 회원만, 같은 시·군·구(수원권 등)끼리
export const DEFAULT_BOARDS = ['자유', '익명', '학교별', '지역별', '취업'];

// 사용자가 만든 게시판
export interface Board {
  id: number;
  name: string;
  pinned: boolean; // 고정(메인에 항상 노출)
  createdAt: string;
}

// 인기 게시판 기준: 글이 이 개수 이상이면 메인에 노출
export const POPULAR_BOARD_MIN_POSTS = 3;

// 댓글 (parentId 가 있으면 다른 댓글에 달린 답글=대댓글)
export interface Comment {
  id: number;
  author: string; // 댓글 작성자 닉네임
  body: string;
  createdAt: string;
  parentId?: number; // 답글이면 부모 댓글 id (없으면 최상위 댓글)
  likes?: number; // 댓글 좋아요 수
  likedByMe?: boolean; // 내가 좋아요 눌렀는지 (1인 1회)
}

// 게시글
export interface Post {
  id: number;
  boardType: BoardType;
  title: string;
  body: string;
  author: string; // 글쓴이 닉네임 (익명이면 '익명')
  anonymous: boolean; // 익명 여부
  mine?: boolean; // 내가 쓴 글인지 (익명 글이라 author 로 못 알 때 서버가 판단해 줌)
  region: string;
  regionCity?: string; // 지역별 게시판 글: 작성자의 거주지(시/군/구). 예: '경기도 수원시'
  school: string;
  likes: number;
  likedByMe: boolean; // 내가 좋아요를 눌렀는지 (1인 1회만 가능)
  images?: string[]; // 첨부 사진들 (최대 5장)
  comments: Comment[];
  createdAt: string;
}

// 회원 정지 기간 선택지
export const SUSPEND_PERIODS = ['1달', '6달', '1년', '2년', '5년'] as const;
export type SuspendPeriod = (typeof SUSPEND_PERIODS)[number];

// 사용자(회원) 계정
export interface UserAccount {
  id: number;
  nickname: string;
  email: string;
  school: string; // 졸업 학교
  gradYear?: string; // 졸업 연도 (예: '2024') — 졸업생 커뮤니티 특성상 함께 표시
  region: string;
  role?: '회원' | '관리자'; // 관리자면 회원 관리 등 운영 기능 사용 가능
  verified?: boolean; // 대학 인증(🎓) 완료 여부 — 닉네임 옆 배지로 표시 (필수 아님)
  schoolMethod?: string; // 대학 인증을 "어떤 수단"으로 받았는지 (배지 차별화용: '대학교 이메일'/'졸업증명서' 등)
  regionVerified?: boolean; // 지역 인증(📍) 완료 여부 — 닉네임 옆 배지로 표시 (필수 아님)
  regionCity?: string; // 지역 인증으로 확인된 정확한 위치 (예: '경기도 수원시') — 배지에 '수원'으로 표시
  hideSchoolName?: boolean; // 배지에 대학교명 표시 안 함 (설정)
  hideRegionName?: boolean; // 배지에 지역명 표시 안 함 (설정)
  status: '정상' | '정지' | '탈퇴';
  suspendReason?: string; // 정지 사유 (status 가 '정지' 일 때)
  suspendPeriod?: SuspendPeriod; // 정지 기간 (1달/6달/1년/2년/5년)
  suspendUntil?: string; // 정지 해제 예정일 (예: '2027.06.13')
}

// 모임 게시글 투표 선택지 (득표수 + 내가 골랐는지)
export interface PollOption {
  id: number;
  label: string;
  votes: number;
  votedByMe: boolean;
}

// 모임 안에서 쓰는 게시글/공지글
export interface MeetupPost {
  id: number;
  title: string;
  body: string;
  author: string; // 작성자 닉네임
  notice: boolean; // 공지글이면 true
  poll?: PollOption[]; // 투표 선택지 (있으면 투표 글)
  comments: Comment[]; // 모임 게시글 댓글 (대댓글 포함)
  createdAt: string;
}

// 모임 가입 인사
export interface MeetupGreeting {
  id: number;
  author: string; // 작성자 닉네임
  body: string;
  createdAt: string;
}

// 모임 가입 신청 (승인제 모임에서, 모임장이 보고 승인/거절)
export interface MeetupJoinRequest {
  id: number;
  applicant: string; // 신청자 닉네임
  intro: string; // 신청자가 적은 간단한 소개/가입 사유
  school?: string; // 신청자 학교 (모임장이 보고 판단)
  region?: string; // 신청자 권역
  createdAt: string;
}

// 모임
export interface Meetup {
  id: number;
  title: string;
  when: string; // 일정 (예: '6/15 (일) 오전 9시')
  place: string;
  capacity: number;
  joined: number; // 현재 참여 인원
  joinedByMe: boolean; // 내가 참여 중인지
  host?: string; // 모임장(만든 사람) 닉네임 — 수정/삭제 권한 판단용
  requireApproval?: boolean; // true 면 모임장 승인을 받아야 가입됨
  joinRequests?: MeetupJoinRequest[]; // 가입 신청 목록 (승인제 모임)
  posts: MeetupPost[]; // 모임 게시판 글 (공지 포함)
  messages: ChatMessage[]; // 모임 단체 채팅 메시지
  greetings: MeetupGreeting[]; // 가입 인사
}

// 중고거래 상품
export interface MarketItem {
  id: number;
  title: string;
  price: number;
  place: string;
  status: '판매중' | '예약중' | '판매완료';
  body: string;
  image?: string; // 상품 사진 (이미지 주소, 없을 수 있음)
  seller?: string; // 판매자(올린 사람) 닉네임 — 내 글인지 판단용
  comments: Comment[]; // 판매글 댓글
}

// 채팅 메시지
export interface ChatMessage {
  id: number;
  text: string;
  mine: boolean; // 내가 보낸 메시지인지
  time: string;
  senderName?: string; // 보낸 사람 닉네임 (말풍선 위에 표시)
  senderAvatar?: string; // 보낸 사람 프로필 사진 (이미지 주소, 없으면 기본 아이콘)
  image?: string; // 첨부 사진 (있으면 말풍선에 사진 표시)
}

// 채팅방에 참여한 사람
export interface ChatMember {
  id: number;
  name: string;
  avatar?: string; // 프로필 사진 (없으면 기본 아이콘)
}

// 목적이 있는 채팅방을 만들 때 고르는 목적들
export const CHAT_PURPOSES = ['스터디', '취미/여가', '운동', '친목', '정보공유', '기타'] as const;
export type ChatPurpose = (typeof CHAT_PURPOSES)[number];

// 채팅방
export interface ChatRoom {
  id: number;
  name: string;
  purpose?: string; // 목적(스터디/운동 등) — 목적 채팅방이면 있음 (1:1 거래방은 없음)
  capacity?: number; // 인원 제한 (목적 채팅방, 최대 100명)
  messages: ChatMessage[];
  members: ChatMember[]; // 채팅방 참여 인원
}

// 둘러보기 목록에 뜨는 공개(목적) 채팅방 요약
export interface OpenRoom {
  id: number;
  name: string;
  purpose: string;
  capacity: number;
  count: number; // 현재 참여 인원
  joinedByMe: boolean; // 내가 이미 참여 중인지
}

// 쪽지 (사용자끼리 주고받는 1:1 메모. 실시간 채팅과 별개)
export interface Note {
  id: number;
  fromName: string; // 보낸 사람 닉네임
  toName: string; // 받는 사람 닉네임 (익명 작성자면 '익명')
  body: string;
  createdAt: string;
  mine: boolean; // 내가 보낸 쪽지면 true (보낸 쪽지함 / 받은 쪽지함 구분)
  read: boolean; // 읽음 여부
}

// 인증 종류: 대학 인증(🎓) / 지역 인증(📍)
export type VerifyType = '대학' | '지역';

// 대학 인증 수단
//  - main(메인): 학교가 발급한 공식 증명서 → 가장 확실한 인증
//  - sub(보조): 메인 서류가 없을 때 쓰는 대체 수단
export const SCHOOL_VERIFY_METHODS = {
  main: ['대학교 이메일', '재학증명서', '졸업증명서'],
  sub: ['졸업앨범', '학생증'],
} as const;

// 지역 인증 수단 (주민등록증은 반드시 주민번호 "뒷자리"를 가리고 제출)
export const REGION_VERIFY_METHODS = ['주민등록증(뒷자리 가림)'] as const;

// 인증 요청 (관리자가 심사) — 대학/지역 공용
export interface VerificationRequest {
  id: number;
  userId: number;
  userName: string; // 신청자 닉네임
  type: VerifyType; // 대학 / 지역
  method: string; // 인증 수단 (예: '졸업증명서', '동문회 이메일', '주민등록증(뒷자리 가림)')
  school: string;
  gradYear?: string;
  realName?: string; // 본인인증으로 확인된 실명 (지역 인증 심사 때 주민등록증과 대조)
  birth?: string; // 본인인증으로 확인된 생년월일 (예: '1999-03-15')
  address?: string; // 가입 때 입력한 실거주지 주소 (지역 인증 때 주민등록증 주소와 대조)
  regionCity?: string; // 지역 인증 시 제출한 정확한 위치 (예: '경기도 수원시')
  cert: string; // 첨부 사진 (D:\Cookie_db\verification 에 저장될 이미지)
  status: '대기' | '승인' | '거절';
  rejectReason?: string; // 거절 시 관리자가 적은 사유
  createdAt: string;
}

// 알림
export interface AppNotification {
  id: number;
  toUser: string; // 알림 받을 사람 닉네임
  message: string;
  postId?: number; // 누르면 이동할 글 (있으면)
  noteWith?: string; // 누르면 이동할 쪽지 대화 상대 (있으면)
  read: boolean;
  createdAt: string;
}

// 신고 사유 선택지 ('기타'를 고르면 직접 입력)
export const REPORT_REASONS = ['욕설/비방', '스팸/광고', '음란물', '사기/허위 거래', '도배', '기타'] as const;

// 신고 (관리자가 확인)
export interface Report {
  id: number;
  reporterName: string; // 신고한 사람
  targetType: '회원' | '게시글' | '댓글' | '채팅방' | '상품' | '모임'; // 신고 대상 종류
  targetUser?: string; // 신고당한 사람 (작성자 닉네임) — 누굴 신고했는지 알기 위함
  targetId?: number; // 신고 대상의 글 id (관리자가 눌러서 바로 볼 수 있게)
  targetLabel: string; // 신고 대상 내용 (제목/댓글 내용 등)
  reason: string; // 신고 사유
  image?: string; // 증거 사진 (스크린샷 등, 없을 수 있음)
  createdAt: string;
  handled: boolean; // 관리자가 처리했는지
}

// 문의하기
export interface Inquiry {
  id: number;
  title: string;
  body: string;
  images?: string[]; // 첨부 사진들 (최대 5장)
  createdAt: string;
  answer?: string; // 관리자 답변 (아직 없으면 비어 있음)
}
