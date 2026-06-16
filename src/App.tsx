// ============================================================
// 청년와글 - 앱의 큰 틀(껍데기)입니다.
//  - 아래쪽 탭 6개(홈/커뮤니티/모임/중고거래/채팅/내 정보)를 전환합니다.
//  - 글 상세, 글쓰기 같은 "세부 화면"은 탭 위에 덮어서 보여주고
//    뒤로가기로 닫습니다. (stack 으로 관리)
// ============================================================
import {useState} from 'react';
import {Bell, CalendarDays, Home, MessageCircle, ShoppingBag, User, Users} from 'lucide-react';
import logoUrl from '../logo.png';

import {DataProvider, useStore} from './data';
import {NavContext, type Screen, type TabKey} from './nav';
import {Avatar, Fab, Header} from './ui';
import {LoginScreen} from './Auth';
import {NotificationsScreen} from './Notifications';
import {VerifyScreen} from './Verify';

import {HomeScreen} from './Home';
import {CommunityScreen, PostDetail, PostForm} from './Community';
import {MeetupScreen, MeetupDetail, MeetupForm, MeetupBoard, MeetupChat, MeetupGreetings} from './Meetup';
import {MarketScreen, MarketDetail, MarketForm} from './Market';
import {ChatScreen, ChatRoom, ChatNew} from './Chat';
import {ProfileScreen, ProfileEdit, UsersScreen, UserForm, InquiryScreen, AdminVerifications, AdminInquiries, AdminReports, NotesScreen, NoteThread, NoteSend} from './Profile';

// 하단 탭 정의 (key, 라벨, 아이콘)
const TABS = [
  {key: 'home', label: '홈', icon: Home, title: '청년와글'},
  {key: 'community', label: '커뮤니티', icon: Users, title: '커뮤니티'},
  {key: 'meetup', label: '모임', icon: CalendarDays, title: '모임'},
  {key: 'market', label: '중고거래', icon: ShoppingBag, title: '중고거래'},
  {key: 'chat', label: '채팅', icon: MessageCircle, title: '채팅'},
  {key: 'profile', label: '내 정보', icon: User, title: '내 정보'},
] as const;

// 탭별 본문 화면
function renderTab(tab: TabKey) {
  switch (tab) {
    case 'home':
      return <HomeScreen />;
    case 'community':
      return <CommunityScreen />;
    case 'meetup':
      return <MeetupScreen />;
    case 'market':
      return <MarketScreen />;
    case 'chat':
      return <ChatScreen />;
    case 'profile':
      return <ProfileScreen />;
  }
}

// 세부 화면(탭 위에 덮이는 화면)
function renderScreen(screen: Screen) {
  switch (screen.name) {
    case 'postDetail':
      return <PostDetail id={screen.id} />;
    case 'postForm':
      return <PostForm id={screen.id} board={screen.board} />;
    case 'meetupDetail':
      return <MeetupDetail id={screen.id} />;
    case 'meetupForm':
      return <MeetupForm id={screen.id} />;
    case 'meetupBoard':
      return <MeetupBoard id={screen.id} />;
    case 'meetupChat':
      return <MeetupChat id={screen.id} />;
    case 'meetupGreetings':
      return <MeetupGreetings id={screen.id} />;
    case 'marketDetail':
      return <MarketDetail id={screen.id} />;
    case 'marketForm':
      return <MarketForm id={screen.id} />;
    case 'chatRoom':
      return <ChatRoom id={screen.id} />;
    case 'chatNew':
      return <ChatNew />;
    case 'profileEdit':
      return <ProfileEdit />;
    case 'users':
      return <UsersScreen />;
    case 'userForm':
      return <UserForm id={screen.id} />;
    case 'inquiry':
      return <InquiryScreen />;
    case 'adminInquiries':
      return <AdminInquiries />;
    case 'adminReports':
      return <AdminReports />;
    case 'verify':
      return <VerifyScreen />;
    case 'adminVerifications':
      return <AdminVerifications />;
    case 'notifications':
      return <NotificationsScreen />;
    case 'notes':
      return <NotesScreen />;
    case 'noteThread':
      return <NoteThread with={screen.with} />;
    case 'noteSend':
      return <NoteSend to={screen.to} />;
  }
}

// 메뉴 맨 아래에 항상 보이는 "내 compact 정보" — 로그인한 동안 상시 노출됩니다.
// 누르면 내 정보 탭으로 이동해요. (사이드바 / 모바일 공용)
function CompactProfile({onClick}: {onClick: () => void}) {
  const {me} = useStore();
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50 active:bg-gray-100"
    >
      <Avatar src={me.avatar} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {me.nickname}
          {me.verified && <span className="ml-0.5" title="대학 인증">🎓</span>}
          {me.regionVerified && <span className="ml-0.5" title="지역 인증">📍</span>}
        </p>
        <p className="truncate text-xs text-gray-500">
          {me.school || '학교 미설정'}
          {me.region ? ` · ${me.region}` : ''}
        </p>
      </div>
    </button>
  );
}

// 넓은 화면(웹/데스크톱)에서만 보이는 왼쪽 사이드바 메뉴입니다.
//  - 좁은 화면(폰/앱)에서는 hidden 이라 안 보이고, 기존 하단 탭 메뉴가 그대로 쓰입니다. (앱 화면 보존)
function DesktopSidebar({
  tab,
  onTab,
  onBell,
  adminPending,
  unread,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  onBell: () => void;
  adminPending: number;
  unread: number;
}) {
  return (
    <aside className="hidden w-56 flex-none flex-col border-r border-gray-200 bg-white md:flex">
      {/* 브랜드 */}
      <button onClick={() => onTab('home')} className="flex items-center gap-2 px-4 py-4">
        <img src={logoUrl} alt="청년와글" className="h-8 w-8 rounded-full object-cover" />
        <span className="text-lg font-bold text-orange-500">청년와글</span>
      </button>
      {/* 세로 메뉴 */}
      <nav className="flex-1 space-y-1 px-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          const badge = t.key === 'profile' ? adminPending : 0;
          return (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                active ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              {t.label}
              {badge > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        {/* 알림 */}
        <button
          onClick={onBell}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <Bell size={20} />
          알림
          {unread > 0 && (
            <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {unread}
            </span>
          )}
        </button>
      </nav>
      {/* 맨 아래: 내 compact 정보 (상시 노출) */}
      <div className="border-t border-gray-100 p-2">
        <CompactProfile onClick={() => onTab('profile')} />
      </div>
    </aside>
  );
}

// "+" 버튼을 누르면 열릴 화면 (탭마다 다름). 없는 탭은 + 버튼이 안 보입니다.
// 커뮤니티는 "선택된 게시판"을 기본값으로 넘겨야 해서 CommunityScreen 안에서 자체 처리합니다.
const FAB_ACTION: Partial<Record<TabKey, Screen>> = {
  meetup: {name: 'meetupForm'},
  market: {name: 'marketForm'},
  chat: {name: 'chatNew'},
};

function AppInner() {
  const {session, me, notifications, verifications, inquiries, reports} = useStore();
  const [tab, setTab] = useState<TabKey>('home');
  const [stack, setStack] = useState<Screen[]>([]); // 열려 있는 세부 화면들

  // 로그인 안 했으면 로그인 화면만 보여줍니다.
  if (session == null) return <LoginScreen />;

  // 내 안 읽은 알림 개수
  const unread = (notifications ?? []).filter((n) => n.toUser === me.nickname && !n.read).length;

  // 관리자: 처리 대기(인증+문의+신고) 합계 → 프로필 탭에 배지로 표시
  const adminPending =
    me.role === '관리자'
      ? (verifications ?? []).filter((v) => v.status === '대기').length +
        (inquiries ?? []).filter((i) => !i.answer).length +
        (reports ?? []).filter((r) => !r.handled).length
      : 0;

  // 화면 이동 함수 묶음
  const nav = {
    push: (screen: Screen) => setStack((prev) => [...prev, screen]),
    pop: () => setStack((prev) => prev.slice(0, -1)),
    goTab: (next: TabKey) => {
      setStack([]); // 세부 화면 모두 닫고
      setTab(next); // 탭 이동
    },
  };

  const topScreen = stack[stack.length - 1]; // 지금 맨 위에 열린 세부 화면
  const currentTab = TABS.find((t) => t.key === tab)!;
  // 인증(대학🎓/지역📍)은 이제 "닉네임 옆 배지"일 뿐, 기능을 막지 않습니다.
  // → 20~30 청년 누구나 글쓰기·모임·중고거래·채팅을 모두 이용할 수 있어요.
  const fab = FAB_ACTION[tab];

  return (
    <NavContext.Provider value={nav}>
      {/* 넓은 화면에서는 [사이드바 + 본문], 좁은 화면(폰/앱)에서는 본문만 (사이드바 hidden) */}
      <div className="mx-auto flex h-full w-full max-w-md bg-gray-100 md:max-w-5xl">
        <DesktopSidebar
          tab={tab}
          onTab={nav.goTab}
          onBell={() => nav.push({name: 'notifications'})}
          adminPending={adminPending}
          unread={unread}
        />

        {/* 앱 본문 (좁은 화면에서는 지금 앱 화면 그대로) */}
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-gray-100">
          {topScreen ? (
            // 세부 화면이 열려 있으면 그것만 꽉 채워 보여줍니다 (뒤로가기는 화면 안 헤더에 있음)
            <div className="h-full">{renderScreen(topScreen)}</div>
          ) : (
            // 평소: 헤더 + 탭 본문 + 하단 탭 메뉴
            <>
              {/* 상단 헤더 — 폰에서만 (웹은 왼쪽 사이드바가 대신) */}
              <div className="md:hidden">
                <Header
                  title={currentTab.title}
                  onLogoClick={() => nav.goTab('home')}
                  onBell={() => nav.push({name: 'notifications'})}
                  bellCount={unread}
                />
              </div>
              {/* 본문 — 웹에서는 너무 넓지 않게 가운데로 모음 */}
              <main className="flex-1 overflow-y-auto pb-2">
                <div className="md:mx-auto md:max-w-2xl">{renderTab(tab)}</div>
              </main>

              {/* 글쓰기/등록 + 버튼 */}
              {fab && <Fab onClick={() => nav.push(fab)} />}

              {/* 내 compact 정보 — 폰에서 하단 탭 바로 위에 상시 노출 */}
              <div className="border-t border-gray-100 bg-white px-3 py-1.5 md:hidden">
                <CompactProfile onClick={() => nav.goTab('profile')} />
              </div>

              {/* 하단 탭 메뉴 — 폰에서만 (웹은 사이드바가 대신) */}
              <nav className="flex border-t border-gray-200 bg-white md:hidden">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = t.key === tab;
                  // 관리자 처리 대기가 있으면 '내 정보' 탭에 빨간 개수 배지
                  const tabBadge = t.key === 'profile' ? adminPending : 0;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                        active ? 'text-orange-500' : 'text-gray-400'
                      }`}
                    >
                      {tabBadge > 0 && (
                        <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {tabBadge}
                        </span>
                      )}
                      <Icon size={20} />
                      {t.label}
                    </button>
                  );
                })}
              </nav>
            </>
          )}
        </div>
      </div>
    </NavContext.Provider>
  );
}

// 데이터 공급기로 앱 전체를 감쌉니다.
export default function App() {
  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
}
