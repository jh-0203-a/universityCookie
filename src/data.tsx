// ============================================================
// 앱의 모든 데이터와 "CRUD" 기능을 한 곳에서 관리하는 파일입니다.
//  - C(Create 생성), R(Read 조회), U(Update 수정), D(Delete 삭제)
//  - 데이터는 브라우저의 localStorage 에 저장되어 새로고침해도 남습니다.
//  - 화면에서는 const store = useStore(); 로 꺼내 씁니다.
// ============================================================
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {DEFAULT_BOARDS} from './types';
import {shortDistrict} from './districts';
import type {
  AppNotification,
  Board,
  ChatRoom,
  Inquiry,
  MarketItem,
  Meetup,
  Note,
  OpenRoom,
  Post,
  Report,
  UserAccount,
  VerificationRequest,
  VerifyType,
} from './types';

// localStorage 에 저장할 때 쓰는 이름표
// (학교별 게시판 규칙 + 모임 자동가입 수정으로 v10 로 올림 → 예전 localStorage 데이터는 버리고 새로 시작)
const STORAGE_KEY = 'cookie-app-data-v10';

// --- 작은 도우미 함수들 ---
let idCounter = 0;
function newId(): number {
  // 시간 + 카운터로 겹치지 않는 번호를 만듭니다.
  idCounter += 1;
  return Date.now() * 1000 + (idCounter % 1000);
}
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}
function clock(): string {
  const d = new Date();
  const h = d.getHours();
  const label = h < 12 ? '오전' : '오후';
  const h12 = ((h + 11) % 12) + 1;
  return `${label} ${h12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// base64 데이터URL 이미지를 백엔드에 업로드하고 저장 경로(/files/...)를 돌려줍니다.
//  - 파일은 D:\Cookie_db\<folder> 에 저장되고, DB·화면엔 경로(URL)만 들어갑니다.
//  - 이미 업로드된 경로(/files/...)나 일반 URL이면 그대로 둡니다.
async function uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append('file', blob, 'image.jpg');
    const res = await fetch(`/api/upload/${folder}`, {method: 'POST', body: form});
    const data = await res.json();
    return data.url ?? dataUrl;
  } catch {
    return dataUrl;
  }
}

// 백엔드(PostgreSQL)가 돌려준 회원 행(snake_case)을 화면용 me(camelCase)로 바꿉니다.
function dbUserToMe(u: Record<string, unknown>): Store['me'] {
  return {
    nickname: String(u.nickname ?? ''),
    school: String(u.school ?? ''),
    region: String(u.region ?? ''),
    gradYear: (u.grad_year as string) ?? undefined,
    role: (u.role as '회원' | '관리자') ?? '회원',
    verified: u.verified === true,
    schoolMethod: (u.school_method as string) ?? undefined,
    regionVerified: u.region_verified === true,
    regionCity: (u.region_city as string) ?? undefined,
    hideSchoolName: u.hide_school_name === true,
    hideRegionName: u.hide_region_name === true,
    avatar: (u.avatar_url as string) ?? undefined,
    phone: (u.phone as string) ?? undefined,
    birth: (u.birth as string) ?? undefined,
  };
}

// 앱 전체 데이터의 모양
interface Store {
  posts: Post[];
  boards: Board[]; // 사용자가 만든 게시판
  users: UserAccount[];
  meetups: Meetup[];
  items: MarketItem[];
  rooms: ChatRoom[];
  inquiries: Inquiry[];
  reports: Report[]; // 신고 모음 (관리자가 확인)
  verifications: VerificationRequest[]; // 졸업 인증 요청 (관리자가 심사)
  notifications: AppNotification[]; // 알림
  notes: Note[]; // 쪽지함 (주고받은 쪽지)
  openRooms: OpenRoom[]; // 둘러보기: 참여할 수 있는 목적 채팅방 목록
  favoriteBoards: string[]; // 내가 고정(즐겨찾기)한 게시판 이름들
  me: {nickname: string; school: string; region: string; gradYear?: string; role?: '회원' | '관리자'; verified?: boolean; schoolMethod?: string; regionVerified?: boolean; regionCity?: string; hideSchoolName?: boolean; hideRegionName?: boolean; avatar?: string; phone?: string; birth?: string; nicknameChangedAt?: string}; // 지금 로그인한 나 (nicknameChangedAt = 마지막 닉네임 변경 시각 ISO)
  session: number | null; // 로그인한 회원 id (로그아웃 상태면 null)
}

// 처음 한 번 보여줄 예시 데이터(목업)
const SEED: Store = {
  session: null, // 처음엔 로그아웃 상태 → 로그인 화면부터 보여줍니다
  me: {nickname: '성대졸업A', school: '성균관대', region: '남서부권', gradYear: '2022', role: '회원', verified: true},
  posts: [
    {id: 1, boardType: '학교별', title: '시험기간 같이 공부할 사람!', body: '중앙도서관에서 매일 오후 2시에 모여요 ☕', author: '성대졸업A', anonymous: false, region: '남서부권', school: '성균관대', likes: 12, likedByMe: false, comments: [{id: 11, author: '아주졸업A', body: '저요! 내일부터 갈게요', createdAt: '2026.06.12'}], createdAt: '2026.06.12'},
    {id: 2, boardType: '자유', title: '자취방 룸메이트 구해요', body: '인계동 근처, 보증금 반반 부담 가능하신 분~', author: '익명', anonymous: true, region: '남서부권', school: '아주대', likes: 8, likedByMe: false, comments: [], createdAt: '2026.06.11'},
    {id: 3, boardType: '익명', title: '학식 추천 좀요 🍚', body: '오늘 점심 뭐 먹지... 추천받습니다', author: '익명', anonymous: true, region: '남서부권', school: '안양대', likes: 24, likedByMe: false, comments: [], createdAt: '2026.06.10'},
  ],
  boards: [
    {id: 801, name: '대학원 준비', pinned: true, createdAt: '2026.06.10'}, // 고정 → 메인에 항상 노출
    {id: 802, name: '자격증', pinned: false, createdAt: '2026.06.10'}, // 글 적고 고정 아님 → 검색으로만
  ],
  users: [
    // ----- 테스트 계정 (비밀번호는 아무거나 입력하면 로그인됨. 기존 회원은 인증 완료로 간주) -----
    {id: 101, nickname: '운영자', email: 'admin@cookie.com', school: '청년와글 운영팀', region: '관리', status: '정상', role: '관리자', verified: true},
    // 같은 권역(남서부권) · 성균관대 2명
    {id: 102, nickname: '성대졸업A', email: 'sungA@skku.ac.kr', school: '성균관대', gradYear: '2022', region: '남서부권', regionCity: '경기도 수원시', status: '정상', role: '회원', verified: true, schoolMethod: '졸업증명서', regionVerified: true},
    {id: 103, nickname: '성대졸업B', email: 'sungB@skku.ac.kr', school: '성균관대', gradYear: '2020', region: '남서부권', status: '정상', role: '회원', verified: true, schoolMethod: '학생증(졸업생 표시)'},
    // 같은 권역(남서부권) · 아주대 2명
    {id: 104, nickname: '아주졸업A', email: 'ajouA@ajou.ac.kr', school: '아주대', gradYear: '2021', region: '남서부권', regionCity: '경기도 수원시', status: '정상', role: '회원', verified: true, schoolMethod: '대학교 이메일', regionVerified: true},
    {id: 105, nickname: '아주졸업B', email: 'ajouB@ajou.ac.kr', school: '아주대', gradYear: '2019', region: '남서부권', status: '정상', role: '회원', verified: true, schoolMethod: '졸업증명서'},
    // 남서부권(안양 일대) · 안양대 1명
    {id: 106, nickname: '안양졸업', email: 'anyang@anyang.ac.kr', school: '안양대', gradYear: '2023', region: '남서부권', status: '정상', role: '회원', verified: true},
    // 경기 남서부권 · 수원대 / 수원여대 재학생 테스트 계정 (대학교 이메일 / 증명서 인증 차이 시연)
    {id: 108, nickname: '수원대생', email: 'student@suwon.ac.kr', school: '수원대학교', region: '남서부권', status: '정상', role: '회원', verified: true, schoolMethod: '대학교 이메일'},
    {id: 109, nickname: '수원여대생', email: 'student@swc.ac.kr', school: '수원여자대학교', region: '남서부권', status: '정상', role: '회원', verified: true, schoolMethod: '재학증명서'},
    // 미인증 데모 회원 (로그인: rookie@gmail.com) — 인증 심사 대기 중
    {id: 107, nickname: '신입동문', email: 'rookie@gmail.com', school: '아주대', gradYear: '2024', region: '남서부권', status: '정상', role: '회원', verified: false},
  ],
  meetups: [
    {id: 201, title: '한강 러닝 모임', when: '6/15 (일) 오전 9시', place: '광교호수공원', capacity: 10, joined: 6, joinedByMe: false, host: '아주졸업A', posts: [], messages: [], greetings: []},
    {
      id: 202,
      title: '코딩 스터디 (React)',
      when: '6/16 (월) 오후 7시',
      place: '온라인 (디스코드)',
      capacity: 8,
      joined: 4,
      joinedByMe: false,
      host: '성대졸업A',
      posts: [
        {id: 1, title: '첫 모임 안내', body: '6/16 저녁 7시에 디스코드로 모여요. 노트북 꼭 챙기기!', author: '쿠키대학생', notice: true, comments: [], createdAt: '2026.06.12'},
      ],
      messages: [{id: 1, text: '다들 환영합니다! 🎉', mine: false, time: '오후 2:00', senderName: '쿠키대학생'}],
      greetings: [{id: 1, author: '아주대생', body: '안녕하세요! React 배우러 왔어요 잘 부탁드려요 :)', createdAt: '2026.06.12'}],
    },
  ],
  items: [
    {id: 301, title: '전공 교재 (경제학원론) 팝니다', price: 12000, place: '성균관대', status: '판매중', body: '작년에 산 책이고 필기 거의 없어요.', seller: '성대졸업A', comments: []},
    {id: 302, title: '아이패드 9세대 64GB', price: 290000, place: '아주대', status: '예약중', body: '액정 깨끗하고 충전기 같이 드려요.', seller: '아주졸업A', comments: []},
  ],
  rooms: [
    {
      id: 401,
      name: '러닝 모임 단톡방',
      members: [
        {id: 102, name: '성대졸업A'},
        {id: 104, name: '아주졸업A'},
        {id: 106, name: '안양졸업'},
      ],
      messages: [{id: 1, text: '내일 비 오면 어떡하죠?', mine: false, time: '오후 3:24', senderName: '아주졸업A'}],
    },
    {
      id: 402,
      name: '교재 거래 (익명)',
      members: [
        {id: 102, name: '성대졸업A'},
        {id: 105, name: '아주졸업B'},
      ],
      messages: [{id: 1, text: '혹시 직거래 가능하실까요?', mine: false, time: '오후 1:10', senderName: '아주졸업B'}],
    },
  ],
  inquiries: [
    {id: 501, title: '인증 메일이 안 와요', body: '학교 이메일로 인증 코드가 오지 않습니다.', createdAt: '2026.06.10', answer: '스팸함을 확인해 주세요. 그래도 없으면 다시 문의 부탁드립니다.'},
  ],
  reports: [
    {id: 701, reporterName: '아주졸업A', targetType: '게시글', targetUser: '성대졸업A', targetId: 1, targetLabel: '시험기간 같이 공부할 사람!', reason: '욕설/비방', createdAt: '2026.06.12', handled: false},
  ],
  verifications: [
    {
      id: 1001,
      userId: 107,
      userName: '신입동문',
      type: '대학',
      method: '졸업증명서',
      school: '아주대',
      gradYear: '2024',
      cert: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="140"><rect width="220" height="140" fill="%23eeeeee"/><text x="110" y="76" font-size="16" text-anchor="middle" fill="%23999999">졸업증명서(예시)</text></svg>',
      status: '대기',
      createdAt: '2026.06.13',
    },
  ],
  notifications: [
    {id: 901, toUser: '성대졸업A', message: '아주졸업A님이 회원님의 글에 댓글을 남겼어요.', postId: 1, read: false, createdAt: '2026.06.12'},
  ],
  notes: [
    {id: 601, fromName: '아주졸업A', toName: '성대졸업A', body: '글 잘 봤어요! 스터디 같이 하실래요?', createdAt: '2026.06.12', mine: false, read: false},
  ],
  openRooms: [],
  favoriteBoards: [],
};

// 화면에서 사용할 데이터 + 기능 묶음
interface DataValue extends Store {
  // 게시글
  addPost: (p: Omit<Post, 'id' | 'likes' | 'likedByMe' | 'comments' | 'createdAt'>) => Promise<number | undefined>; // 새 글 id 반환
  updatePost: (id: number, p: Partial<Post>) => void;
  deletePost: (id: number) => void;
  toggleLike: (id: number) => void;
  // 게시판
  addBoard: (name: string) => Promise<string | null>; // 실패하면 에러 메시지, 성공하면 null
  togglePinBoard: (id: number) => void;
  addComment: (postId: number, body: string, parentId?: number) => void;
  deleteComment: (postId: number, commentId: number) => void;
  toggleCommentLike: (postId: number, commentId: number) => void; // 댓글 좋아요 (1인 1회)
  // 사용자
  addUser: (u: Omit<UserAccount, 'id'>) => void;
  updateUser: (id: number, u: Partial<UserAccount>) => void;
  deleteUser: (id: number) => void;
  // 모임
  addMeetup: (m: Omit<Meetup, 'id' | 'joined' | 'joinedByMe' | 'posts' | 'messages' | 'greetings'>) => void;
  updateMeetup: (id: number, m: Partial<Meetup>) => void;
  deleteMeetup: (id: number) => void;
  toggleJoin: (id: number) => void;
  // 승인제 모임 가입 신청 / 취소 / (모임장) 승인·거절
  requestJoin: (meetupId: number, intro: string) => void;
  cancelJoinRequest: (meetupId: number) => void;
  approveJoinRequest: (meetupId: number, reqId: number) => void;
  rejectJoinRequest: (meetupId: number, reqId: number) => void;
  addMeetupPost: (meetupId: number, p: {title: string; body: string; notice: boolean; poll?: string[]}) => void; // 모임 게시글/공지 작성 (poll = 투표 선택지)
  deleteMeetupPost: (meetupId: number, postId: number) => void;
  voteMeetupPoll: (meetupId: number, postId: number, optionId: number) => void; // 모임 게시글 투표(같은 선택지 다시 누르면 취소)
  addMeetupPostComment: (meetupId: number, postId: number, body: string, parentId?: number) => void; // 모임 게시글 댓글/답글
  deleteMeetupPostComment: (meetupId: number, commentId: number) => void;
  sendMeetupMessage: (meetupId: number, text: string, image?: string) => void; // 모임 채팅 보내기
  addMeetupGreeting: (meetupId: number, body: string) => void; // 가입 인사 남기기
  // 중고거래
  addItem: (i: Omit<MarketItem, 'id' | 'comments'>) => void;
  updateItem: (id: number, i: Partial<MarketItem>) => void;
  deleteItem: (id: number) => void;
  addItemComment: (itemId: number, body: string, parentId?: number) => void;
  deleteItemComment: (itemId: number, commentId: number) => void;
  // 채팅
  sendMessage: (roomId: number, text: string, image?: string) => void;
  leaveRoom: (roomId: number) => void; // 채팅방 나가기
  openDirectRoom: (name: string, partner: string) => Promise<number>; // 1:1 채팅방 열기(없으면 생성), 방 id 반환
  createRoom: (name: string, purpose: string, capacity: number) => Promise<number>; // 목적 채팅방 개설, 방 id 반환
  joinRoom: (roomId: number) => Promise<{ok: boolean; error?: string}>; // 목적 채팅방 참여(정원 초과면 실패)
  refreshOpenRooms: () => Promise<void>; // 둘러보기 목록 새로고침
  // 게시판 개인 고정
  toggleBoardFavorite: (boardName: string) => void;
  // 문의
  addInquiry: (title: string, body: string, images?: string[]) => void;
  deleteInquiry: (id: number) => void;
  answerInquiry: (id: number, answer: string) => void; // 관리자 답변
  // 신고
  addReport: (targetType: Report['targetType'], targetLabel: string, reason: string, targetUser?: string, targetId?: number, image?: string) => void;
  markReportHandled: (id: number) => void; // 관리자가 처리 완료 표시
  // 알림
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  // 쪽지
  sendNote: (toName: string, body: string) => void; // 쪽지 보내기
  deleteNote: (id: number) => void;
  markNoteRead: (id: number) => void; // 받은 쪽지 읽음 처리
  // 내 정보
  updateMe: (m: Partial<Store['me']>) => void;
  // 닉네임 → 인증 배지 정보 (대학 인증 🎓 / 지역 인증 📍 + 대학 인증 수단 + 학교명). 닉네임 옆 배지 표시에 사용.
  badgesOf: (nickname: string) => {school: boolean; region: boolean; schoolMethod?: string; schoolName?: string; regionName?: string; hideSchool?: boolean; hideRegion?: boolean};
  // 로그인 / 로그아웃 / 회원가입 (실제 PostgreSQL 백엔드와 통신 → 비동기)
  login: (email: string, password: string) => Promise<string | null>; // 실패하면 에러 메시지, 성공하면 null
  logout: () => void;
  signup: (u: {nickname: string; email: string; password: string; school: string; gradYear: string; region: string; phone: string; realName: string; birth: string}) => Promise<string | null>;
  // 휴대폰 본인인증 (회원가입용 문자 OTP) — 본인인증으로 실명·생년월일도 함께 확인됩니다.
  sendOtp: (phone: string) => Promise<{ok: boolean; error?: string; devCode?: string}>; // 인증번호 보내기 (devCode = 개발용)
  verifyOtp: (phone: string, code: string, realName: string, birth: string) => Promise<string | null>; // 인증번호+신원 확인: 성공 null, 실패 메시지
  // 대학교 이메일 인증 (학교 이메일로 코드 발송 → 코드 확인 시 대학 인증 자동 완료)
  sendEmailOtp: (email: string) => Promise<{ok: boolean; error?: string; devCode?: string}>;
  verifyEmailOtp: (email: string, code: string) => Promise<string | null>; // 성공 null(그리고 me 에 대학 인증 반영), 실패 메시지
  // 인증 (대학🎓 / 지역📍)
  submitVerification: (type: VerifyType, method: string, cert: string, regionCity?: string) => void; // 회원: 인증 서류 제출(심사 요청). 지역 인증은 regionCity('경기도 수원시') 포함
  resetVerification: (type: VerifyType) => void; // 인증 초기화(방법 변경용): 대학→verified, 지역→regionVerified 해제
  approveVerification: (reqId: number) => void; // 관리자: 승인 → 종류에 맞는 배지 부여
  rejectVerification: (reqId: number, reason?: string) => void; // 관리자: 거절 (+ 사유)
}

const DataContext = createContext<DataValue | null>(null);

// 화면에서 데이터를 꺼내 쓰는 훅
export function useStore(): DataValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('DataProvider 안에서만 useStore 를 쓸 수 있어요.');
  return value;
}

// 앱 전체를 감싸서 데이터를 공급하는 컴포넌트
export function DataProvider({children}: {children: ReactNode}) {
  // 처음 시작할 때 localStorage 에 저장된 값이 있으면 불러오고, 없으면 예시 데이터 사용
  const [store, setStore] = useState<Store>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as Store;
      } catch {
        // 저장값이 깨졌으면 무시하고 기본값 사용
      }
    }
    return SEED;
  });

  // store 가 바뀔 때마다 localStorage 에 자동 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      // 사진(base64)을 많이 첨부하면 localStorage 용량(약 5MB)을 넘을 수 있어요.
      // 이때 저장은 실패하지만, 앱이 흰 화면으로 죽지 않도록 에러를 여기서 막아줍니다.
      console.warn('저장 공간이 부족해 일부 데이터가 저장되지 않았어요. (사진을 줄여보세요)', e);
    }
  }, [store]);

  // 게시글은 이제 DB(PostgreSQL)에서 불러옵니다. (작성·댓글·좋아요 후에도 이걸로 새로고침)
  async function refreshPosts() {
    try {
      const res = await fetch(`/api/posts?userId=${store.session ?? 0}`);
      const data = await res.json();
      if (Array.isArray(data.posts)) setStore((s) => ({...s, posts: data.posts}));
    } catch {
      // 서버가 꺼져 있으면 기존 데이터를 유지합니다.
    }
  }
  // 모임도 DB에서 불러옵니다.
  async function refreshMeetups() {
    try {
      const res = await fetch(`/api/meetups?userId=${store.session ?? 0}`);
      const data = await res.json();
      if (Array.isArray(data.meetups)) setStore((s) => ({...s, meetups: data.meetups}));
    } catch {
      // 서버가 꺼져 있으면 기존 데이터 유지
    }
  }
  // 중고거래도 DB에서 불러옵니다.
  async function refreshItems() {
    try {
      const res = await fetch('/api/items');
      const data = await res.json();
      if (Array.isArray(data.items)) setStore((s) => ({...s, items: data.items}));
    } catch {
      // 서버가 꺼져 있으면 기존 데이터 유지
    }
  }
  // 나머지 기능들도 모두 DB에서 불러옵니다. (서버가 꺼져 있으면 기존 데이터 유지)
  //  - key: 서버 응답의 배열 이름(예: 'boards'),  field: store 에 넣을 이름과 같습니다.
  async function refreshList(url: string, key: string, field: keyof Store) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data[key])) setStore((s) => ({...s, [field]: data[key]}));
    } catch {
      // 서버 연결 실패 시 조용히 넘어갑니다.
    }
  }
  const sid = () => store.session ?? 0; // 지금 로그인한 회원 id (없으면 0)
  const refreshBoards = () => refreshList('/api/boards', 'boards', 'boards');
  const refreshNotifications = () => refreshList(`/api/notifications?userId=${sid()}`, 'notifications', 'notifications');
  const refreshNotes = () => refreshList(`/api/notes?userId=${sid()}`, 'notes', 'notes');
  const refreshRooms = () => refreshList(`/api/rooms?userId=${sid()}`, 'rooms', 'rooms');
  const refreshInquiries = () => refreshList(`/api/inquiries?userId=${sid()}`, 'inquiries', 'inquiries');
  const refreshReports = () => refreshList('/api/reports', 'reports', 'reports');
  const refreshVerifications = () => refreshList('/api/verifications', 'verifications', 'verifications');
  const refreshUsers = () => refreshList('/api/users', 'users', 'users');
  const refreshOpenRooms = () => refreshList(`/api/rooms/open?userId=${sid()}`, 'rooms', 'openRooms');
  const refreshBoardFavorites = () => refreshList(`/api/board-favorites?userId=${sid()}`, 'favorites', 'favoriteBoards');

  // 받는 사람(닉네임)에게 알림을 보냅니다. (서버에서 익명 등 못 찾으면 조용히 무시)
  async function notify(toNick: string, type: string, message: string, extra?: {postId?: number; noteWith?: string}) {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({toNick, type, message, postId: extra?.postId, noteWith: extra?.noteWith}),
    }).catch(() => {});
  }

  // 로그인하면 DB에서 모든 데이터를 한 번 불러옵니다.
  useEffect(() => {
    if (store.session != null) {
      refreshPosts();
      refreshMeetups();
      refreshItems();
      refreshBoards();
      refreshNotifications();
      refreshNotes();
      refreshRooms();
      refreshInquiries();
      refreshReports();
      refreshVerifications();
      refreshUsers();
      refreshOpenRooms();
      refreshBoardFavorites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.session]);

  const value: DataValue = {
    ...store,

    // 게시글 CRUD
    // 게시글: DB에 저장합니다. (사진은 D:\Cookie_db\board 에 파일로 올리고 경로만 DB에)
    addPost: async (p) => {
      const images = await Promise.all((p.images ?? []).map((im) => uploadDataUrl(im, 'board')));
      // 새로 만든 글의 id 를 받아서 돌려줍니다. (작성 후 바로 그 글로 이동하려고)
      let newId: number | undefined;
      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            authorId: store.session,
            boardType: p.boardType,
            title: p.title,
            body: p.body,
            anonymous: p.anonymous,
            school: p.school,
            region: p.region,
            regionCity: p.regionCity,
            images,
          }),
        });
        const data = await res.json();
        newId = Number(data.id) || undefined;
      } catch {
        // 서버 연결 실패 시 id 없이 진행
      }
      await refreshPosts();
      return newId;
    },
    updatePost: async (id, p) => {
      const images = p.images ? await Promise.all(p.images.map((im) => uploadDataUrl(im, 'board'))) : undefined;
      await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title: p.title, body: p.body, boardType: p.boardType, anonymous: p.anonymous, images}),
      }).catch(() => {});
      await refreshPosts();
    },
    deletePost: async (id) => {
      await fetch(`/api/posts/${id}`, {method: 'DELETE'}).catch(() => {});
      await refreshPosts();
    },
    // 좋아요 토글 (DB) + 글쓴이 알림(로컬)
    toggleLike: async (id) => {
      const post = store.posts.find((p) => p.id === id);
      const willLike = post && !post.likedByMe;
      await fetch(`/api/posts/${id}/like`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session}),
      }).catch(() => {});
      if (willLike && post && !post.anonymous && post.author !== store.me.nickname) {
        await notify(post.author, 'like', `${store.me.nickname}님이 회원님의 글을 좋아합니다.`, {postId: id});
      }
      await refreshPosts();
    },

    // 게시판 만들기 (기본/기존 이름과 중복 불가) — DB에 저장
    addBoard: async (name) => {
      const trimmed = name.trim();
      if (!trimmed) return '게시판 이름을 입력해 주세요.';
      // 기본 게시판 이름과는 겹칠 수 없어요. (그 외 중복은 서버가 한 번 더 확인)
      if (DEFAULT_BOARDS.includes(trimmed) || (store.boards ?? []).some((b) => b.name === trimmed)) return '이미 있는 게시판이에요.';
      try {
        const res = await fetch('/api/boards', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({createdBy: store.session, name: trimmed}),
        });
        const data = await res.json();
        if (!res.ok) return data.error ?? '게시판을 만들지 못했어요.';
      } catch {
        return '서버에 연결할 수 없어요. (npm run server)';
      }
      await refreshBoards();
      return null;
    },
    togglePinBoard: async (id) => {
      await fetch(`/api/boards/${id}/pin`, {method: 'POST'}).catch(() => {});
      await refreshBoards();
    },
    // 댓글 작성 (DB) + 글쓴이 알림(로컬)
    addComment: async (postId, body, parentId) => {
      const post = store.posts.find((x) => x.id === postId);
      await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({authorId: store.session, body, parentId}),
      }).catch(() => {});
      // 답글이면 부모 댓글 작성자에게, 일반 댓글이면 글쓴이에게 알림
      const parent = parentId ? post?.comments.find((c) => c.id === parentId) : undefined;
      if (parent && parent.author !== '익명' && parent.author !== store.me.nickname) {
        await notify(parent.author, 'comment', `${store.me.nickname}님이 회원님의 댓글에 답글을 남겼어요.`, {postId});
      } else if (!parentId && post && !post.anonymous && post.author !== store.me.nickname) {
        await notify(post.author, 'comment', `${store.me.nickname}님이 회원님의 글에 댓글을 남겼어요.`, {postId});
      }
      await refreshPosts();
    },
    deleteComment: async (_postId, commentId) => {
      await fetch(`/api/comments/${commentId}`, {method: 'DELETE'}).catch(() => {});
      await refreshPosts();
    },
    // 댓글 좋아요 토글 (DB) + 댓글 작성자 알림(로컬)
    toggleCommentLike: async (postId, commentId) => {
      const post = store.posts.find((p) => p.id === postId);
      const c = post?.comments.find((cm) => cm.id === commentId);
      const willLike = c && !c.likedByMe;
      await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session}),
      }).catch(() => {});
      if (willLike && c && c.author !== store.me.nickname) {
        await notify(c.author, 'like', `${store.me.nickname}님이 회원님의 댓글을 좋아합니다.`, {postId});
      }
      await refreshPosts();
    },

    // 사용자 CRUD — 관리자 회원 관리 (DB에 저장)
    //  - addUser: 회원은 회원가입(signup)으로 만들어지므로, 여기선 화면 목록에만 임시로 추가합니다.
    addUser: (u) => setStore((s) => ({...s, users: [{...u, id: newId()}, ...s.users]})),
    updateUser: async (id, u) => {
      await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(u),
      }).catch(() => {});
      await refreshUsers();
    },
    deleteUser: async (id) => {
      await fetch(`/api/users/${id}`, {method: 'DELETE'}).catch(() => {});
      await refreshUsers();
    },

    // 모임 CRUD — 이제 DB(PostgreSQL)에 저장합니다.
    addMeetup: async (m) => {
      await fetch('/api/meetups', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({createdBy: store.session, title: m.title, when: m.when, place: m.place, capacity: m.capacity, requireApproval: m.requireApproval}),
      }).catch(() => {});
      await refreshMeetups();
    },
    updateMeetup: async (id, m) => {
      await fetch(`/api/meetups/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title: m.title, when: m.when, place: m.place, capacity: m.capacity, requireApproval: m.requireApproval}),
      }).catch(() => {});
      await refreshMeetups();
    },
    deleteMeetup: async (id) => {
      await fetch(`/api/meetups/${id}`, {method: 'DELETE'}).catch(() => {});
      await refreshMeetups();
    },
    toggleJoin: async (id) => {
      await fetch(`/api/meetups/${id}/toggle-join`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session}),
      }).catch(() => {});
      await refreshMeetups();
    },
    // 승인제 모임 가입 신청 / 취소 / (모임장) 승인·거절
    requestJoin: async (meetupId, intro) => {
      await fetch(`/api/meetups/${meetupId}/request`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session, intro}),
      }).catch(() => {});
      await refreshMeetups();
    },
    cancelJoinRequest: async (meetupId) => {
      await fetch(`/api/meetups/${meetupId}/request`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session}),
      }).catch(() => {});
      await refreshMeetups();
    },
    approveJoinRequest: async (meetupId, reqId) => {
      await fetch(`/api/meetups/${meetupId}/approve`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reqId}),
      }).catch(() => {});
      await refreshMeetups();
    },
    rejectJoinRequest: async (meetupId, reqId) => {
      await fetch(`/api/meetups/${meetupId}/reject`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reqId}),
      }).catch(() => {});
      await refreshMeetups();
    },
    // 모임 게시판: 공지/게시글 작성·삭제 (poll = 투표 선택지 목록)
    addMeetupPost: async (meetupId, p) => {
      await fetch(`/api/meetups/${meetupId}/posts`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({authorId: store.session, title: p.title, body: p.body, notice: p.notice, poll: p.poll}),
      }).catch(() => {});
      await refreshMeetups();
    },
    deleteMeetupPost: async (_meetupId, postId) => {
      await fetch(`/api/meetup-posts/${postId}`, {method: 'DELETE'}).catch(() => {});
      await refreshMeetups();
    },
    // 모임 게시글 투표 (같은 선택지를 다시 누르면 취소)
    voteMeetupPoll: async (_meetupId, postId, optionId) => {
      await fetch(`/api/meetup-posts/${postId}/vote`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session, optionId}),
      }).catch(() => {});
      await refreshMeetups();
    },
    // 모임 게시글 댓글/답글 (parentId 있으면 답글)
    addMeetupPostComment: async (meetupId, postId, body, parentId) => {
      const post = store.meetups.find((m) => m.id === meetupId)?.posts.find((p) => p.id === postId);
      await fetch(`/api/meetup-posts/${postId}/comments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({authorId: store.session, body, parentId}),
      }).catch(() => {});
      // 답글이면 부모 댓글 작성자, 아니면 게시글 작성자에게 알림
      const parent = parentId ? post?.comments.find((c) => c.id === parentId) : undefined;
      if (parent && parent.author !== store.me.nickname) {
        await notify(parent.author, 'comment', `${store.me.nickname}님이 회원님의 댓글에 답글을 남겼어요.`);
      } else if (!parentId && post && post.author !== store.me.nickname) {
        await notify(post.author, 'comment', `${store.me.nickname}님이 회원님의 모임 글에 댓글을 남겼어요.`);
      }
      await refreshMeetups();
    },
    deleteMeetupPostComment: async (_meetupId, commentId) => {
      await fetch(`/api/meetup-post-comments/${commentId}`, {method: 'DELETE'}).catch(() => {});
      await refreshMeetups();
    },
    // 모임 채팅: 사진은 D:\Cookie_db\group 에 업로드 후 경로만 저장
    sendMeetupMessage: async (meetupId, text, image) => {
      const imageUrl = image ? await uploadDataUrl(image, 'group') : undefined;
      await fetch(`/api/meetups/${meetupId}/messages`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({senderId: store.session, text, image: imageUrl}),
      }).catch(() => {});
      await refreshMeetups();
    },
    // 모임 가입 인사 남기기
    addMeetupGreeting: async (meetupId, body) => {
      await fetch(`/api/meetups/${meetupId}/greetings`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({authorId: store.session, body}),
      }).catch(() => {});
      await refreshMeetups();
    },

    // 중고거래 CRUD — DB에 저장 (사진은 D:\Cookie_db\transaction)
    addItem: async (i) => {
      const image = i.image ? await uploadDataUrl(i.image, 'transaction') : undefined;
      await fetch('/api/items', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sellerId: store.session, title: i.title, price: i.price, place: i.place, status: i.status, body: i.body, image}),
      }).catch(() => {});
      await refreshItems();
    },
    updateItem: async (id, i) => {
      const image = i.image ? await uploadDataUrl(i.image, 'transaction') : undefined;
      await fetch(`/api/items/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title: i.title, price: i.price, place: i.place, status: i.status, body: i.body, image}),
      }).catch(() => {});
      await refreshItems();
    },
    deleteItem: async (id) => {
      await fetch(`/api/items/${id}`, {method: 'DELETE'}).catch(() => {});
      await refreshItems();
    },
    // 판매글 댓글 — DB(item_comments)에 저장. 내 글이 아니면 판매자에게 알림
    addItemComment: async (itemId, body, parentId) => {
      const item = store.items.find((x) => x.id === itemId);
      await fetch(`/api/items/${itemId}/comments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({authorId: store.session, body, parentId}),
      }).catch(() => {});
      const parent = parentId ? item?.comments.find((c) => c.id === parentId) : undefined;
      if (parent && parent.author !== store.me.nickname) {
        await notify(parent.author, 'comment', `${store.me.nickname}님이 회원님의 댓글에 답글을 남겼어요.`);
      } else if (!parentId && item && item.seller && item.seller !== store.me.nickname) {
        await notify(item.seller, 'comment', `${store.me.nickname}님이 회원님의 판매글에 댓글을 남겼어요.`);
      }
      await refreshItems();
    },
    deleteItemComment: async (_itemId, commentId) => {
      await fetch(`/api/item-comments/${commentId}`, {method: 'DELETE'}).catch(() => {});
      await refreshItems();
    },

    // 채팅 — DB(chat_messages)에 저장. 사진은 D:\Cookie_db\etc 에 올리고 경로만 저장
    sendMessage: async (roomId, text, image) => {
      const imageUrl = image ? await uploadDataUrl(image, 'etc') : undefined;
      await fetch(`/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({senderId: store.session, text, image: imageUrl}),
      }).catch(() => {});
      await refreshRooms();
    },
    // 채팅방 나가기: 내 참여만 빠집니다. (아무도 안 남으면 방도 사라짐)
    leaveRoom: async (roomId) => {
      await fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session}),
      }).catch(() => {});
      await refreshRooms();
    },
    // 같은 이름의 1:1 채팅방이 있으면 그 방 id 를, 없으면 새로 만들어 그 id 를 돌려줍니다.
    openDirectRoom: async (name, partner) => {
      try {
        const res = await fetch('/api/rooms/direct', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: store.session, name, partnerNick: partner}),
        });
        const data = await res.json();
        await refreshRooms();
        return Number(data.id) || 0;
      } catch {
        return 0;
      }
    },
    // 목적 채팅방 개설 (개설자가 첫 멤버) → 만든 방 id 반환
    createRoom: async (name, purpose, capacity) => {
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: store.session, name, purpose, capacity}),
        });
        const data = await res.json();
        await refreshRooms();
        await refreshOpenRooms();
        return Number(data.id) || 0;
      } catch {
        return 0;
      }
    },
    // 목적 채팅방 참여 (정원이 가득 차면 실패 메시지 반환)
    joinRoom: async (roomId) => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: store.session}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return {ok: false, error: data.error || '참여하지 못했어요.'};
        await refreshRooms();
        await refreshOpenRooms();
        return {ok: true};
      } catch {
        return {ok: false, error: '네트워크 오류예요.'};
      }
    },
    refreshOpenRooms,
    // 게시판 개인 고정 토글 (DB) — 즉시 새로고침
    toggleBoardFavorite: async (boardName) => {
      await fetch('/api/board-favorites/toggle', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session, boardName}),
      }).catch(() => {});
      await refreshBoardFavorites();
    },

    // 문의 — DB(inquiries). 사진은 D:\Cookie_db\ask 에 올리고 경로만 저장
    addInquiry: async (title, body, images) => {
      const urls = await Promise.all((images ?? []).map((im) => uploadDataUrl(im, 'ask')));
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session, title, body, images: urls}),
      }).catch(() => {});
      await refreshInquiries();
    },
    deleteInquiry: async (id) => {
      await fetch(`/api/inquiries/${id}`, {method: 'DELETE'}).catch(() => {});
      await refreshInquiries();
    },
    answerInquiry: async (id, answer) => {
      await fetch(`/api/inquiries/${id}/answer`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({answer, adminId: store.session}),
      }).catch(() => {});
      await refreshInquiries();
    },

    // 신고 — DB(reports). 증거 사진은 D:\Cookie_db\report 에 올리고 경로만 저장
    addReport: async (targetType, targetLabel, reason, targetUser, targetId, image) => {
      const imageUrl = image ? await uploadDataUrl(image, 'report') : undefined;
      await fetch('/api/reports', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reporterId: store.session, targetType, targetLabel, reason, targetUser, targetId, image: imageUrl}),
      }).catch(() => {});
      await refreshReports();
    },
    markReportHandled: async (id) => {
      await fetch(`/api/reports/${id}/handle`, {method: 'POST'}).catch(() => {});
      await refreshReports();
    },

    // 쪽지 — DB(notes)에 저장. 받는 사람 알림은 서버가 함께 만들어 줍니다.
    sendNote: async (toName, body) => {
      await fetch('/api/notes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({fromId: store.session, toName, body}),
      }).catch(() => {});
      await refreshNotes();
    },
    deleteNote: async (id) => {
      await fetch(`/api/notes/${id}`, {method: 'DELETE'}).catch(() => {});
      await refreshNotes();
    },
    markNoteRead: async (id) => {
      await fetch(`/api/notes/${id}/read`, {method: 'POST'}).catch(() => {});
      await refreshNotes();
    },
    // 알림 — DB(notifications)
    markNotificationRead: async (id) => {
      await fetch(`/api/notifications/${id}/read`, {method: 'POST'}).catch(() => {});
      await refreshNotifications();
    },
    markAllNotificationsRead: async () => {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session}),
      }).catch(() => {});
      await refreshNotifications();
    },

    // 내 정보 수정 — 화면 즉시 반영 + DB 저장. 프로필 사진은 D:\Cookie_db\profile 에 올리고 경로만 저장.
    updateMe: async (m) => {
      const patch = {...m};
      if (patch.avatar && patch.avatar.startsWith('data:')) {
        patch.avatar = await uploadDataUrl(patch.avatar, 'profile');
      }
      setStore((s) => ({...s, me: {...s.me, ...patch}})); // 화면 먼저 갱신
      if (store.session != null) {
        // nicknameChangedAt 은 화면 전용(30일 제한 표시)이라 DB로 보내지 않습니다.
        const {nicknameChangedAt: _omit, ...dbPatch} = patch;
        await fetch(`/api/users/${store.session}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(dbPatch),
        }).catch(() => {});
      }
    },

    // 닉네임으로 회원을 찾아 인증 배지 여부를 돌려줍니다. (없는 닉네임/익명이면 둘 다 false)
    badgesOf: (nickname) => {
      // 로그인한 본인은 DB에서 받은 me 를 "우선" 사용합니다.
      // (localStorage 시드 목록(store.users)은 오래돼 인증 수단이 빠져 있을 수 있어, 본인 배지가 어긋나는 걸 방지)
      if (nickname === store.me.nickname)
        return {
          school: store.me.verified === true,
          region: store.me.regionVerified === true,
          schoolMethod: store.me.schoolMethod,
          schoolName: store.me.school,
          regionName: shortDistrict(store.me.regionCity),
          hideSchool: store.me.hideSchoolName === true,
          hideRegion: store.me.hideRegionName === true,
        };
      // 그 외(데모 회원 등)는 store.users 에서 찾습니다.
      const u = store.users.find((x) => x.nickname === nickname);
      if (u)
        return {
          school: u.verified === true,
          region: u.regionVerified === true,
          schoolMethod: u.schoolMethod,
          schoolName: u.school,
          regionName: shortDistrict(u.regionCity),
          hideSchool: u.hideSchoolName === true,
          hideRegion: u.hideRegionName === true,
        };
      return {school: false, region: false};
    },

    // 로그인: 실제 백엔드(PostgreSQL)에 물어봅니다. (시드 계정은 비번 아무거나 통과)
    login: async (email, password) => {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: email.trim(), password}),
        });
        const data = await res.json();
        if (!res.ok) return data.error ?? '로그인에 실패했어요.';
        // 로그인한 회원 정보(DB)로 '나(me)'와 세션을 채웁니다.
        setStore((s) => ({...s, session: Number(data.user.id), me: dbUserToMe(data.user)}));
        return null; // 성공
      } catch {
        return '서버에 연결할 수 없어요. 백엔드 서버를 켜 주세요. (터미널에서 npm run server)';
      }
    },
    // 로그아웃: 세션만 비웁니다.
    logout: () => setStore((s) => ({...s, session: null})),
    // 회원가입: 실제 백엔드(PostgreSQL)에 저장하고 바로 로그인합니다.
    // 신규 회원은 인증 전(verified:false) — 인증은 선택이며, 안 해도 모든 기능을 씁니다.
    signup: async (u) => {
      try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            nickname: u.nickname.trim(),
            email: u.email.trim(),
            password: u.password,
            school: u.school.trim(),
            gradYear: u.gradYear.trim(),
            region: u.region.trim(),
            phone: u.phone.trim(),
            realName: u.realName.trim(),
            birth: u.birth.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) return data.error ?? '회원가입에 실패했어요.';
        // 가입된 회원(DB)으로 바로 로그인 처리.
        setStore((s) => ({...s, session: Number(data.user.id), me: dbUserToMe(data.user)}));
        return null; // 성공
      } catch {
        return '서버에 연결할 수 없어요. 백엔드 서버를 켜 주세요. (터미널에서 npm run server)';
      }
    },
    // 휴대폰 본인인증: 인증번호 보내기 (개발 중엔 devCode 로 번호를 돌려줘 테스트)
    sendOtp: async (phone) => {
      try {
        const res = await fetch('/api/send-otp', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({phone}),
        });
        const data = await res.json();
        if (!res.ok) return {ok: false, error: data.error ?? '인증번호 전송에 실패했어요.'};
        return {ok: true, devCode: data.devCode};
      } catch {
        return {ok: false, error: '서버에 연결할 수 없어요. (npm run server)'};
      }
    },
    // 휴대폰 본인인증: 인증번호 확인 (본인인증으로 실명·생년월일도 함께 확정)
    verifyOtp: async (phone, code, realName, birth) => {
      try {
        const res = await fetch('/api/verify-otp', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({phone, code, realName, birth}),
        });
        const data = await res.json();
        if (!res.ok) return data.error ?? '인증에 실패했어요.';
        return null;
      } catch {
        return '서버에 연결할 수 없어요. (npm run server)';
      }
    },
    // 대학교 이메일 인증: 학교 이메일로 코드 보내기
    sendEmailOtp: async (email) => {
      try {
        const res = await fetch('/api/send-email-otp', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email}),
        });
        const data = await res.json();
        if (!res.ok) return {ok: false, error: data.error ?? '인증코드 전송에 실패했어요.'};
        return {ok: true, devCode: data.devCode};
      } catch {
        return {ok: false, error: '서버에 연결할 수 없어요. (npm run server)'};
      }
    },
    // 대학교 이메일 인증: 코드 확인 → 성공 시 DB·me 에 "대학 인증(이메일)" 반영
    verifyEmailOtp: async (email, code) => {
      try {
        const res = await fetch('/api/verify-email-otp', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email, code, userId: store.session}),
        });
        const data = await res.json();
        if (!res.ok) return data.error ?? '인증에 실패했어요.';
        if (!data.user) return '인증을 계정에 반영하지 못했어요. 다시 로그인한 뒤 시도해 주세요.';
        setStore((s) => ({...s, me: dbUserToMe(data.user)})); // 배지·권한 바로 반영
        return null;
      } catch {
        return '서버에 연결할 수 없어요. (npm run server)';
      }
    },
    // 회원: 인증 서류 제출 → 관리자 심사 대기(요청 생성). 바로 인증되지 않습니다.
    //  - 로그인한 본인(me) 기준으로 만듭니다. (DB 로그인 사용자는 s.users 목록에 없을 수 있어 me 를 씁니다)
    //  - 같은 종류(대학/지역)의 대기 요청이 있으면 새 사진·수단으로 갱신, 없으면 새로 생성.
    submitVerification: async (type, method, cert, regionCity) => {
      // 인증 사진은 D:\Cookie_db\verification 에 파일로 올리고 경로만 저장합니다. (7일 후 자동 삭제)
      const certUrl = await uploadDataUrl(cert, 'verification');
      await fetch('/api/verifications', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: store.session, type, method, cert: certUrl, regionCity}),
      }).catch(() => {});
      await refreshVerifications();
    },
    // 회원: 인증 초기화(방법 변경) → 배지 해제. DB에도 반영.
    resetVerification: async (type) => {
      const patch = type === '지역' ? {regionVerified: false} : {verified: false, schoolMethod: undefined};
      setStore((s) => ({...s, me: {...s.me, ...patch}})); // 화면 먼저 반영
      if (store.session != null) {
        await fetch('/api/reset-verification', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: store.session, type}),
        }).catch(() => {});
      }
      await refreshUsers();
    },
    // 관리자: 승인 → 종류에 맞는 배지 부여(대학→verified, 지역→regionVerified), 요청 '승인'. DB에 저장.
    approveVerification: async (reqId) => {
      await fetch(`/api/verifications/${reqId}/approve`, {method: 'POST'}).catch(() => {});
      await refreshVerifications();
      await refreshUsers();
    },
    rejectVerification: async (reqId, reason) => {
      await fetch(`/api/verifications/${reqId}/reject`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reason}),
      }).catch(() => {});
      await refreshVerifications();
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
