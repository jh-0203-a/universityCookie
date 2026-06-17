// ============================================================
// 홈 화면: 게시판별 박스로 나눠 각 게시판의 "최근 글 3개"를 제목 목록으로 보여줍니다.
// 제목을 누르면 글 상세 화면이 열립니다.
// ============================================================
import {useStore} from './data';
import {useNav} from './nav';
import {DEFAULT_BOARDS} from './types';

export function HomeScreen() {
  const {posts, boards} = useStore();
  const nav = useNav();

  function openPost(postId: number) {
    nav.push({name: 'postDetail', id: postId});
  }

  // 학교별·지역별은 권역/거주지 제한 게시판이라, 그 게시판을 볼 수 없는 사람에겐
  // 인기글/홈박스에 떠도 열 수 없는 "없는 글"이 됩니다. → 홈에서는 제외합니다.
  const RESTRICTED_BOARDS = ['학교별', '지역별'];

  // 인기 글: (제한 게시판 제외) 좋아요 많은 순 상위 2개 (좋아요 0개는 제외)
  const popular = [...posts]
    .filter((p) => p.likes > 0 && !RESTRICTED_BOARDS.includes(p.boardType))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 2);

  // 홈에 보여줄 게시판: 기본 게시판(제한 게시판 제외) + 글이 있는 사용자 게시판
  const homeBoards = [
    ...DEFAULT_BOARDS.filter((b) => !RESTRICTED_BOARDS.includes(b)),
    ...(boards ?? []).map((b) => b.name).filter((name) => posts.some((p) => p.boardType === name)),
  ];

  return (
    <div className="space-y-3 p-4">
      {/* 상단: 배너 + 캐릭터를 넓은 화면에선 가로로 나란히 (좌우 폭 채우기) */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col justify-center rounded-2xl bg-orange-500 p-5 text-white">
          <p className="text-lg font-bold">🌱 우리 동네 청년 생활 플랫폼</p>
          <p className="mt-1 text-sm text-orange-50">20·30 청년들의 모임·중고거래·스터디, 한 곳에서</p>
        </div>
        <WelcomeBuddy />
      </div>

      {/* 인기 글 모아보기 — 가로로 긴 카드들 */}
      {popular.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2.5 text-sm font-bold text-gray-900">🔥 인기 글</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {popular.map((post) => (
              <button
                key={post.id}
                onClick={() => openPost(post.id)}
                className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-left transition hover:bg-orange-100 active:opacity-70"
              >
                <span className="flex-none rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-600">{post.boardType}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{post.title}</span>
                <span className="flex-none text-xs text-orange-500">♥ {post.likes}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 게시판별 박스: 넓은 화면에선 2~3칸 그리드로 좌우를 꽉 채움 */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {homeBoards.map((board) => {
          const recent = posts.filter((p) => p.boardType === board).slice(0, 4); // DB가 최신순이라 앞 4개 = 최근
          return (
            <div key={board} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="mb-2.5 text-sm font-bold text-gray-900">📋 {board} 게시판</p>
              {recent.length === 0 ? (
                <p className="text-sm text-gray-400">아직 글이 없어요.</p>
              ) : (
                <div className="space-y-1.5">
                  {recent.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => openPost(post.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-gray-50 active:opacity-70"
                    >
                      <span className="text-orange-300">·</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{post.title}</span>
                      <span className="flex-none text-xs text-gray-400">💬 {post.comments.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 홈 상단에서 손을 흔들며 반겨주는 통통하고 귀여운 청년 캐릭터.
//  - 의존성 없이 인라인 SVG + CSS 키프레임으로 만들어요. (몸은 살짝 통통 들썩, 팔은 손 흔들기)
function WelcomeBuddy() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-orange-50 p-4">
      {/* 이 컴포넌트 전용 애니메이션 (다른 곳과 안 겹치게 wagle- 접두사) */}
      <style>{`
        @keyframes wagle-bob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes wagle-wave { 0%{transform:rotate(-10deg)} 50%{transform:rotate(20deg)} 100%{transform:rotate(-10deg)} }
        .wagle-buddy{ animation: wagle-bob 2.4s ease-in-out infinite; }
        .wagle-arm{ transform-box: fill-box; transform-origin: 55% 92%; animation: wagle-wave 0.85s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){ .wagle-buddy,.wagle-arm{ animation: none } }
      `}</style>

      <svg className="wagle-buddy flex-none" width="84" height="84" viewBox="0 0 200 200" role="img" aria-label="손 흔들며 환영하는 청년 캐릭터">
        {/* 발 */}
        <ellipse cx="86" cy="186" rx="11" ry="7" fill="#5B4636" />
        <ellipse cx="116" cy="186" rx="11" ry="7" fill="#5B4636" />

        {/* 통통한 몸(후드티) */}
        <ellipse cx="100" cy="142" rx="46" ry="42" fill="#F97316" />
        <ellipse cx="100" cy="152" rx="22" ry="26" fill="#FB923C" />

        {/* 쉬고 있는 오른팔 */}
        <path d="M138 120 L156 148" stroke="#FFD9B3" strokeWidth="16" strokeLinecap="round" />
        <circle cx="158" cy="151" r="11" fill="#FFD9B3" />

        {/* 손 흔드는 왼팔 (이 그룹만 회전 애니메이션) */}
        <g className="wagle-arm">
          <path d="M62 122 L46 80" stroke="#FFD9B3" strokeWidth="16" strokeLinecap="round" />
          <circle cx="44" cy="74" r="12" fill="#FFD9B3" />
        </g>

        {/* 머리 */}
        <circle cx="100" cy="68" r="37" fill="#FFD9B3" />
        {/* 앞머리 */}
        <path d="M64 64 Q66 31 100 31 Q134 31 136 64 Q120 48 100 48 Q80 48 64 64 Z" fill="#5B4636" />
        {/* 볼터치 */}
        <circle cx="78" cy="78" r="7" fill="#FFB3B3" opacity="0.75" />
        <circle cx="122" cy="78" r="7" fill="#FFB3B3" opacity="0.75" />
        {/* 웃는 눈 */}
        <circle cx="88" cy="66" r="4.5" fill="#3E3330" />
        <circle cx="112" cy="66" r="4.5" fill="#3E3330" />
        <circle cx="89.5" cy="64.5" r="1.4" fill="#fff" />
        <circle cx="113.5" cy="64.5" r="1.4" fill="#fff" />
        {/* 미소 */}
        <path d="M86 82 Q100 94 114 82" stroke="#A65A28" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </svg>

      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900">안녕하세요! 👋</p>
        <p className="mt-0.5 text-xs text-gray-500">우리 동네 청년들이 기다리고 있어요. 반가워요!</p>
      </div>
    </div>
  );
}
