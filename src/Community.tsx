// ============================================================
// 커뮤니티(게시판) 관련 화면 모음입니다.
//  - CommunityScreen : 게시판 글 목록 + 게시판 필터
//  - PostDetail      : 글 상세보기 (좋아요 / 댓글 / 수정 / 삭제)
//  - PostForm        : 글쓰기 / 글수정
// ============================================================
import {useState} from 'react';
import {Search, Star} from 'lucide-react';
import {useStore} from './data';
import {useNav} from './nav';
import {CommentThread} from './Comments';
import {DEFAULT_BOARDS, POPULAR_BOARD_MIN_POSTS, type BoardType, type Post, type Report} from './types';
import {REGION_TREE} from './regions';
import {shortDistrict} from './districts';
import {Avatar, DangerButton, Empty, Fab, Field, GhostButton, MultiImagePicker, Page, PrimaryButton, ReportModal, VerifiedBadges, inputClass} from './ui';

// ----- 게시판 글 목록 -----
export function CommunityScreen() {
  const {posts, boards, me, favoriteBoards} = useStore();
  const nav = useNav();
  // 현재 보고 있는 게시판 (null = 전체)
  const [board, setBoard] = useState<BoardType | null>(null);
  const [searchOpen, setSearchOpen] = useState(false); // 게시판 검색/만들기 오버레이

  // 누구나 글을 읽고 쓸 수 있어요. (인증은 배지일 뿐, 더 이상 관문이 아님)
  function openPost(postId: number) {
    nav.push({name: 'postDetail', id: postId});
  }

  const isAdmin = me.role === '관리자';
  // 인증 회원(대학🎓 또는 지역📍)이거나 관리자만 '자유' 외 게시판을 이용할 수 있어요.
  // 미인증 가입자는 '자유' 게시판만 열람할 수 있습니다. (커뮤니티 관리)
  const isMember = isAdmin || me.verified === true || me.regionVerified === true;
  const effBoard: BoardType | null = isMember ? board : '자유'; // 미인증이면 무조건 자유로 고정

  // 학교별 게시판: 대학 인증🎓 회원만 + 같은 권역끼리만 (지역 인증만으론 불가).
  //  - 관리자는 권역 상관없이 모두 보고, 권역을 골라서 볼 수도 있어요.
  const isSchoolBoard = effBoard === '학교별';
  const canSchool = isAdmin || me.verified === true; // 학교별 = "대학" 인증 필요
  const [schoolFilter, setSchoolFilter] = useState('전체'); // 고른 학교 (전체 = 모든 학교)
  const [regionFilter, setRegionFilter] = useState('전체'); // 관리자 전용: 고른 권역 (전체 = 모든 권역)

  // 권역 전체 목록 (관리자 권역 드롭다운용)
  const allRegions = REGION_TREE.flatMap((s) => s.areas.map((a) => a.region));

  // 학교별 글이 "볼 수 있는 범위"에 드는지: 관리자=선택 권역(전체 가능), 일반 회원=내 권역만
  const inSchoolScope = (p: Post) =>
    isAdmin ? regionFilter === '전체' || p.region === regionFilter : p.region === me.region;

  // 권역 이름으로 그 권역의 학교 목록(REGION_TREE)을 찾습니다.
  const schoolsOfRegion = (regionName: string) =>
    REGION_TREE.flatMap((s) => s.areas).find((a) => a.region === regionName)?.schools ?? [];

  // 드롭다운에 보여줄 학교 목록 = 그 범위(권역)의 "전체 학교"(REGION_TREE) + 혹시 목록에 없는 글쓴이 학교까지.
  //  - 글이 없어도 권역에 속한 학교는 모두 골라볼 수 있게 합니다. (관리자 '전체'면 전 권역 학교)
  const scopeSchools = isAdmin
    ? regionFilter === '전체'
      ? REGION_TREE.flatMap((s) => s.areas.flatMap((a) => a.schools))
      : schoolsOfRegion(regionFilter)
    : schoolsOfRegion(me.region);
  const postedSchools = posts
    .filter((p) => p.boardType === '학교별' && inSchoolScope(p) && p.school)
    .map((p) => p.school);
  const schoolsInRegion = Array.from(new Set([...scopeSchools, ...postedSchools]));

  // 관리자가 권역을 바꾸면 학교 선택은 전체로 초기화
  function changeRegionFilter(r: string) {
    setRegionFilter(r);
    setSchoolFilter('전체');
  }

  // 지역별 게시판: 지역 인증📍 회원만 + 같은 시·군·구(수원권/강남권/부평권)끼리만.
  //  - 거주지 인증 때 받은 regionCity 의 시·군·구를 묶음 단위로 씁니다. (예: '경기도 수원시' → '수원권')
  const isRegionBoard = effBoard === '지역별';
  const canRegion = isAdmin || me.regionVerified === true; // 지역별 = "지역" 인증 필요
  const [districtFilter, setDistrictFilter] = useState('전체'); // 관리자 전용: 고른 지역(시·군·구)
  // 거주지 → 묶음 이름 (수원시 → '수원권'). 없으면 '지역'.
  const groupLabel = (regionCity?: string) => {
    const d = shortDistrict(regionCity || '');
    return d ? `${d}권` : '지역';
  };
  const myDistrict = shortDistrict(me.regionCity || ''); // 내 거주지 시·군·구 (수원/강남/부평)
  // 지역별 글이 "볼 수 있는 범위"에 드는지: 관리자=선택 지역(전체 가능), 일반 회원=내 거주지만
  const inRegionScope = (p: Post) => {
    const d = shortDistrict(p.regionCity || '');
    if (!d) return false; // 거주지 없는 글은 노출 안 함
    return isAdmin ? districtFilter === '전체' || d === districtFilter : d === myDistrict;
  };
  // 관리자 지역 선택 드롭다운: 지역별 글이 올라온 시·군·구 목록
  const districtsWithPosts = Array.from(
    new Set(posts.filter((p) => p.boardType === '지역별' && p.regionCity).map((p) => shortDistrict(p.regionCity!))),
  ).filter(Boolean);

  // 글쓰기 버튼: 자유는 누구나, 그 외는 인증 필요(학교별=대학 인증, 지역별=지역 인증)
  function handleFab() {
    if (isSchoolBoard && !canSchool) {
      if (window.confirm('학교별 게시판은 대학 인증🎓을 한 회원만 글을 쓸 수 있어요. 인증하러 갈까요?'))
        nav.push({name: 'verify'});
      return;
    }
    if (isRegionBoard && !canRegion) {
      if (window.confirm('지역별 게시판은 지역 인증📍을 한 회원만 글을 쓸 수 있어요. 인증하러 갈까요?'))
        nav.push({name: 'verify'});
      return;
    }
    nav.push({name: 'postForm', board: effBoard ?? undefined});
  }

  // 메인에 보일 게시판: 기본 게시판 + (고정했거나 글 많은) 사용자 게시판
  const customVisible = (boards ?? []).filter(
    (b) => b.pinned || posts.filter((p) => p.boardType === b.name).length >= POPULAR_BOARD_MIN_POSTS,
  );
  const chipNames = [...DEFAULT_BOARDS, ...customVisible.map((b) => b.name)];
  // 내가 개인 고정(📌)한 게시판은 글 수·관리자 고정과 상관없이 항상 칩에 보이게 합니다.
  for (const name of favoriteBoards ?? []) if (!chipNames.includes(name)) chipNames.push(name);
  // 검색으로 들어온 게시판이 칩에 없으면 추가로 보여줍니다.
  if (effBoard && !chipNames.includes(effBoard)) chipNames.push(effBoard);
  // 미인증이면 칩은 '자유'만, 인증/관리자는 전체 + 모든 칩
  const chipOptions: (BoardType | null)[] = isMember ? [null, ...chipNames] : ['자유'];

  // 선택한 게시판에 맞는 글만 걸러냅니다.
  //  - 학교별: "같은 권역" 글 + 드롭다운에서 고른 학교만 (권역끼리만 공유)
  //  - 지역별: "같은 시·군·구(수원권 등)" 글만 (거주지끼리만 공유)
  const visible = effBoard
    ? posts.filter((p) => {
        if (p.boardType !== effBoard) return false;
        if (isSchoolBoard) return inSchoolScope(p) && (schoolFilter === '전체' || p.school === schoolFilter);
        if (isRegionBoard) return inRegionScope(p);
        return true;
      })
    : // '전체' 보기에서는 학교별·지역별 글을 제외합니다. (인증·범위 제한 게시판이라 전체 피드에 섞이면 안 됨)
      posts.filter((p) => p.boardType !== '학교별' && p.boardType !== '지역별');

  return (
    <div>
      {/* 위쪽 게시판 필터 (가로 스크롤) + 검색 버튼 */}
      <div className="flex items-center gap-2 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-1 gap-2 overflow-x-auto">
          {chipOptions.map((b) => (
            <button
              key={b ?? '전체'}
              onClick={() => setBoard(b)}
              className={`flex flex-none items-center gap-0.5 rounded-full px-3 py-1 text-sm ${
                effBoard === b ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {/* 내가 개인 고정한 게시판이면 ★ 표시 */}
              {b && (favoriteBoards ?? []).includes(b) && <Star size={12} fill="currentColor" />}
              {b ?? '전체'}
            </button>
          ))}
        </div>
        {/* 게시판 검색/만들기 — 인증 회원만 (미인증은 자유 게시판만) */}
        {isMember && (
          <button onClick={() => setSearchOpen(true)} className="flex-none text-gray-500" aria-label="게시판 검색">
            <Search size={20} />
          </button>
        )}
      </div>

      {/* 미인증 회원 안내: 자유 게시판만 이용 가능 */}
      {!isMember && (
        <button
          onClick={() => nav.push({name: 'verify'})}
          className="block w-full bg-orange-50 px-4 py-2 text-left text-xs text-orange-700 active:bg-orange-100"
        >
          🔒 지금은 <b>자유 게시판</b>만 볼 수 있어요. <b>대학🎓 또는 지역📍 인증</b>을 하면 익명·취업·학교별 게시판도 이용할 수 있어요. <b className="underline">인증하기</b>
        </button>
      )}

      {/* 게시판 검색/만들기 오버레이 */}
      {searchOpen && (
        <BoardSearch
          onClose={() => setSearchOpen(false)}
          onPick={(name) => {
            setBoard(name);
            setSearchOpen(false);
          }}
        />
      )}

      {isSchoolBoard && !canSchool ? (
        // 대학 인증 안 한 회원: 학교별 게시판 잠금 + 설명
        <div className="m-4 rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-3xl">🏫🔒</p>
          <p className="mt-2 font-semibold text-gray-800">학교별 게시판은 대학 인증 회원만 이용할 수 있어요</p>
          <p className="mt-1 text-sm text-gray-500">
            같은 권역(<b>{me.region || '내 권역'}</b>) 회원끼리 학교 이야기를 나누는 공간이에요. 대학 인증🎓을 하면 글을 읽고 쓸 수 있어요.
          </p>
          <button
            onClick={() => nav.push({name: 'verify'})}
            className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
          >
            대학 인증하기
          </button>
        </div>
      ) : isRegionBoard && !canRegion ? (
        // 지역 인증 안 한 회원: 지역별 게시판 잠금 + 설명
        <div className="m-4 rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-3xl">📍🔒</p>
          <p className="mt-2 font-semibold text-gray-800">지역별 게시판은 지역 인증 회원만 이용할 수 있어요</p>
          <p className="mt-1 text-sm text-gray-500">
            같은 동네(<b>{myDistrict ? `${myDistrict}권` : '내 지역'}</b>) 회원끼리 우리 지역 이야기를 나누는 공간이에요. 지역 인증📍을 하면 글을 읽고 쓸 수 있어요.
          </p>
          <button
            onClick={() => nav.push({name: 'verify'})}
            className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
          >
            지역 인증하기
          </button>
        </div>
      ) : (
        <>
          {/* 학교별 게시판 규칙 안내 + (관리자) 권역 선택 + 공유 중인 학교 드롭다운 */}
          {isSchoolBoard && (
            <>
              <div className="bg-orange-50 px-4 py-2 text-xs leading-relaxed text-orange-700">
                {isAdmin ? (
                  <>🏫 <b>관리자</b>는 <b>모든 권역</b>의 학교별 글을 볼 수 있어요. 아래에서 권역·학교를 골라보세요.</>
                ) : (
                  <>🏫 <b>학교별 게시판</b>은 <b>대학 인증🎓 회원</b>만 글을 쓸 수 있고, <b>같은 권역({me.region || '내 권역'}) 회원끼리만</b> 보고 공유해요.</>
                )}
              </div>
              <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-2">
                {/* 관리자만: 권역 선택 */}
                {isAdmin && (
                  <select
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none"
                    value={regionFilter}
                    onChange={(e) => changeRegionFilter(e.target.value)}
                  >
                    <option value="전체">모든 권역</option>
                    {allRegions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
                {/* 공유 중인 학교 선택 */}
                <select
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none"
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                >
                  <option value="전체">학교 전체 ({schoolsInRegion.length}개교)</option>
                  {schoolsInRegion.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* 지역별 게시판 규칙 안내 + (관리자) 지역(시·군·구) 선택 */}
          {isRegionBoard && (
            <>
              <div className="bg-orange-50 px-4 py-2 text-xs leading-relaxed text-orange-700">
                {isAdmin ? (
                  <>📍 <b>관리자</b>는 <b>모든 지역</b>의 지역별 글을 볼 수 있어요. 아래에서 지역을 골라보세요.</>
                ) : (
                  <>📍 <b>지역별 게시판</b>은 <b>지역 인증📍 회원</b>만 글을 쓸 수 있고, <b>같은 동네({myDistrict ? `${myDistrict}권` : '내 지역'}) 회원끼리만</b> 보고 공유해요.</>
                )}
              </div>
              {/* 관리자만: 지역(시·군·구) 선택 */}
              {isAdmin && (
                <div className="border-b border-gray-100 bg-white px-4 py-2">
                  <select
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none"
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                  >
                    <option value="전체">모든 지역</option>
                    {districtsWithPosts.map((d) => (
                      <option key={d} value={d}>
                        {d}권
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {visible.length === 0 ? (
            <Empty
              text={
                isSchoolBoard
                  ? isAdmin
                    ? '선택한 범위에 학교별 글이 없어요.'
                    : `아직 ${me.region || '우리 권역'}에 학교별 글이 없어요. 첫 글을 써보세요!`
                  : isRegionBoard
                    ? isAdmin
                      ? '선택한 지역에 지역별 글이 없어요.'
                      : `아직 ${myDistrict ? `${myDistrict}권` : '우리 동네'}에 지역별 글이 없어요. 첫 글을 써보세요!`
                    : '아직 글이 없어요. 오른쪽 아래 + 버튼으로 글을 써보세요!'
              }
            />
          ) : (
            <div className="space-y-3 p-4">
              {visible.map((post) => (
            <button
              key={post.id}
              onClick={() => openPost(post.id)}
              className="block w-full rounded-xl bg-white p-4 text-left shadow-sm active:bg-gray-50"
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                <span className="rounded bg-gray-100 px-1.5 py-0.5">{post.boardType}</span>
                <Avatar src={post.authorAvatar} size={20} />
                <span>
                  {post.anonymous ? '익명' : post.author}
                  {!post.anonymous && <VerifiedBadges nickname={post.author} />}
                </span>
                {/* 학교별 게시판 글이면 작성자의 학교를 자동으로 표시 */}
                {post.boardType === '학교별' && (
                  <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-600">🏫 {post.school}</span>
                )}
                {/* 지역별 게시판 글이면 작성자의 동네(수원권 등)를 표시 */}
                {post.boardType === '지역별' && (
                  <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-600">📍 {groupLabel(post.regionCity)}</span>
                )}
                <span>· {post.createdAt}</span>
              </div>
              <h2 className="font-semibold text-gray-900">{post.title}</h2>
              <div className="flex gap-2">
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-gray-600">{post.body}</p>
                {post.images && post.images.length > 0 && (
                  <div className="relative mt-1 flex-none">
                    <img src={post.images[0]} alt="첨부 사진" className="h-16 w-16 rounded-lg object-cover" />
                    {/* 사진이 여러 장이면 개수 표시 */}
                    {post.images.length > 1 && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] text-white">
                        +{post.images.length - 1}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-gray-400">
                <span>♥ {post.likes}</span>
                <span>💬 {post.comments.length}</span>
              </div>
            </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* 글쓰기 버튼 — 지금 보고 있는 게시판을 기본값으로. 학교별은 인증 회원만 (handleFab 에서 처리) */}
      <Fab onClick={handleFab} />
    </div>
  );
}

// ----- 게시판 검색 / 만들기 (아래에서 올라오는 시트) -----
function BoardSearch({onClose, onPick}: {onClose: () => void; onPick: (name: string) => void}) {
  const {posts, boards, me, addBoard, togglePinBoard, favoriteBoards, toggleBoardFavorite} = useStore();
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const isFav = (name: string) => (favoriteBoards ?? []).includes(name); // 내가 개인 고정했는지

  // 기본 + 사용자 게시판 전체를 검색 대상으로
  const all = [
    ...DEFAULT_BOARDS.map((name) => ({id: -1, name, pinned: false, isDefault: true})),
    ...(boards ?? []).map((b) => ({...b, isDefault: false})),
  ];
  const filtered = all.filter((b) => b.name.includes(query.trim()));

  async function handleCreate() {
    const err = await addBoard(newName);
    if (err) {
      window.alert(err);
      return;
    }
    const name = newName.trim();
    setNewName('');
    onPick(name); // 만든 게시판으로 바로 이동
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[85%] w-full overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-base font-bold text-gray-900">게시판 찾기</p>

        {/* 검색 */}
        <input
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="게시판 이름 검색"
        />

        <div className="mt-2 space-y-1">
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-gray-400">검색 결과가 없어요.</p>}
          {filtered.map((b) => (
            <div key={`${b.name}`} className="flex items-center gap-2">
              {/* 개인 고정(★): 누구나 자기 화면에 게시판을 항상 띄워둘 수 있어요 */}
              <button
                onClick={() => toggleBoardFavorite(b.name)}
                className={`flex-none ${isFav(b.name) ? 'text-orange-500' : 'text-gray-300'}`}
                aria-label={isFav(b.name) ? '개인 고정 해제' : '개인 고정'}
                title={isFav(b.name) ? '내 화면에 고정됨 (해제하려면 클릭)' : '내 화면에 고정하기'}
              >
                <Star size={18} fill={isFav(b.name) ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => onPick(b.name)} className="flex-1 rounded-lg px-3 py-2 text-left text-sm text-gray-800 active:bg-gray-50">
                {b.name}
                {b.isDefault && <span className="ml-1 text-xs text-gray-400">기본</span>}
                {!b.isDefault && b.pinned && <span className="ml-1 text-xs text-orange-500">📌 고정</span>}
                <span className="ml-1 text-xs text-gray-400">· 글 {posts.filter((p) => p.boardType === b.name).length}</span>
              </button>
              {/* 관리자는 사용자 게시판을 (모두에게) 고정/해제할 수 있어요 */}
              {!b.isDefault && me.role === '관리자' && (
                <button onClick={() => togglePinBoard(b.id)} className="flex-none text-xs text-orange-500">
                  {b.pinned ? '고정해제' : '고정'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 새 게시판 만들기 */}
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-1 text-sm font-medium text-gray-700">새 게시판 만들기</p>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 공모전"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <PrimaryButton onClick={handleCreate}>만들기</PrimaryButton>
          </div>
          <p className="mt-1 text-xs text-gray-400">만든 게시판은 글이 쌓이거나 관리자가 고정하면 메인에 보여요.</p>
        </div>
      </div>
    </div>
  );
}

// ----- 글 상세보기 -----
export function PostDetail({id}: {id: number}) {
  const {posts, me, toggleLike, deletePost, addComment, deleteComment, toggleCommentLike, addReport} = useStore();
  const nav = useNav();
  // 신고 대상 (게시글/댓글). null 이면 신고 모달이 안 보입니다.
  const [reportTarget, setReportTarget] = useState<{type: Report['targetType']; label: string; user?: string; targetId?: number} | null>(null);

  const post = posts.find((p) => p.id === id);
  // 글이 삭제되었거나 없으면 안내
  if (!post) {
    return (
      <Page title="글" onBack={nav.pop}>
        <Empty text="삭제되었거나 없는 글이에요." />
      </Page>
    );
  }

  function handleDelete() {
    if (window.confirm('이 글을 삭제할까요?')) {
      deletePost(id);
      nav.pop(); // 목록으로 돌아가기
    }
  }

  return (
    <Page title={post.boardType} onBack={nav.pop}>
      <div className="space-y-4 p-4">
        {/* 글 본문 */}
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
            <Avatar src={post.authorAvatar} size={28} />
            <span>
              {post.anonymous ? '익명' : post.author}
              {!post.anonymous && <VerifiedBadges nickname={post.author} />}
            </span>
            {/* 학교별 게시판 글이면 작성자의 학교를 자동으로 표시 */}
            {post.boardType === '학교별' && (
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-600">🏫 {post.school}</span>
            )}
            {/* 지역별 게시판 글이면 작성자의 동네(수원권 등)를 표시 */}
            {post.boardType === '지역별' && (
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-600">
                📍 {shortDistrict(post.regionCity || '') ? `${shortDistrict(post.regionCity || '')}권` : '지역'}
              </span>
            )}
            <span>· {post.createdAt}</span>
            {/* 내 글이 아니면 쪽지 보내기 / 신고하기 */}
            {post.author !== me.nickname && (
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => nav.push({name: 'noteSend', to: post.anonymous ? '익명' : post.author})}
                  className="rounded bg-orange-50 px-2 py-0.5 text-orange-600"
                >
                  쪽지 보내기
                </button>
                <button
                  onClick={() =>
                    setReportTarget({
                      type: '게시글',
                      label: post.title,
                      user: post.anonymous ? '익명' : post.author,
                      targetId: id,
                    })
                  }
                  className="rounded bg-red-50 px-2 py-0.5 text-red-500"
                >
                  신고
                </button>
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{post.title}</h2>
          {post.images?.map((src, i) => (
            <img key={i} src={src} alt={`첨부 사진 ${i + 1}`} className="mt-2 w-full rounded-lg object-cover" />
          ))}
          <p className="mt-2 whitespace-pre-wrap text-gray-700">{post.body}</p>
        </div>

        {/* 좋아요 / 수정 / 삭제 */}
        <div className="flex items-center gap-2 border-y border-gray-100 py-2">
          <button
            onClick={() => toggleLike(id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              post.likedByMe ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'
            }`}
          >
            {post.likedByMe ? '♥' : '♡'} 좋아요 {post.likes}
          </button>
          <div className="flex-1" />
          {/* 수정/삭제는 내 글이거나 관리자일 때만 (익명 글도 서버가 mine 으로 판단) */}
          {(post.mine || post.author === me.nickname || me.role === '관리자') && (
            <>
              <GhostButton onClick={() => nav.push({name: 'postForm', id})}>수정</GhostButton>
              <DangerButton onClick={handleDelete}>삭제</DangerButton>
            </>
          )}
        </div>

        {/* 댓글 + 대댓글(답글) */}
        <CommentThread
          comments={post.comments}
          meNick={me.nickname}
          isAdmin={me.role === '관리자'}
          onAdd={(body, parentId) => addComment(id, body, parentId)}
          onDelete={(cid) => deleteComment(id, cid)}
          renderActions={(c) => (
            <>
              {/* 댓글 좋아요 (1인 1회) */}
              <button
                onClick={() => toggleCommentLike(id, c.id)}
                className={`text-xs ${c.likedByMe ? 'text-orange-500' : 'text-gray-400'}`}
              >
                {c.likedByMe ? '♥' : '♡'} {c.likes ?? 0}
              </button>
              {/* 내 댓글이 아니면 신고 */}
              {c.author !== me.nickname && (
                <button
                  onClick={() => setReportTarget({type: '댓글', label: c.body, user: c.author, targetId: id})}
                  className="text-xs text-red-400"
                >
                  신고
                </button>
              )}
            </>
          )}
        />
      </div>

      {/* 신고 모달 (게시글/댓글 공용) */}
      {reportTarget && (
        <ReportModal
          who={reportTarget.user}
          onClose={() => setReportTarget(null)}
          onSubmit={(reason) => {
            addReport(reportTarget.type, reportTarget.label, reason, reportTarget.user, reportTarget.targetId);
            window.alert('신고가 접수되었어요. 관리자 확인 후 조치하겠습니다.');
          }}
        />
      )}
    </Page>
  );
}

// ----- 글쓰기 / 글수정 -----
export function PostForm({id, board}: {id?: number; board?: BoardType}) {
  const {posts, boards, me, addPost, updatePost} = useStore();
  const nav = useNav();

  // 수정 모드이면 기존 글을 불러옵니다.
  const editing = posts.find((p) => p.id === id);
  // 글쓰기 게시판 선택지: 기본 + 사용자가 만든 게시판
  const boardOptions = [...DEFAULT_BOARDS, ...(boards ?? []).map((b) => b.name)];

  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [boardType, setBoardType] = useState<BoardType>(editing?.boardType ?? board ?? '자유');
  const [anonymous, setAnonymous] = useState(editing?.anonymous ?? false);
  const [images, setImages] = useState<string[]>(editing?.images ?? []);

  // 인증 회원(대학🎓/지역📍) 또는 관리자만 자유 외 게시판에 글을 쓸 수 있어요.
  const isMember = me.role === '관리자' || me.verified === true || me.regionVerified === true;

  // 익명 게시판은 무조건 익명입니다. (체크란 없이 자동 익명)
  const isAnonBoard = boardType === '익명';

  async function handleSave() {
    if (!title.trim()) {
      window.alert('제목을 입력해 주세요.');
      return;
    }
    // 익명 게시판이면 강제로 익명, 그 외에는 사용자가 고른 값을 씁니다.
    const finalAnonymous = isAnonBoard ? true : anonymous;
    // 미인증 회원은 자유 게시판에만 글을 쓸 수 있어요.
    if (boardType !== '자유' && !isMember) {
      window.alert('자유 게시판은 누구나 쓸 수 있어요. 다른 게시판은 대학🎓 또는 지역📍 인증 후 이용할 수 있어요.');
      return;
    }
    // 학교별 게시판은 대학 인증🎓 회원만 글을 쓸 수 있어요.
    if (boardType === '학교별' && me.verified !== true) {
      window.alert('학교별 게시판은 대학 인증🎓을 한 회원만 글을 쓸 수 있어요. 프로필에서 대학 인증을 해주세요.');
      return;
    }
    // 지역별 게시판은 지역 인증📍 회원만 글을 쓸 수 있어요. (거주지가 있어야 같은 지역끼리 묶여요)
    if (boardType === '지역별' && me.regionVerified !== true) {
      window.alert('지역별 게시판은 지역 인증📍을 한 회원만 글을 쓸 수 있어요. 프로필에서 지역 인증을 해주세요.');
      return;
    }
    if (editing) {
      // 수정 → 원래 글 상세로 돌아가기
      updatePost(editing.id, {title, body, boardType, anonymous: finalAnonymous, images, author: finalAnonymous ? '익명' : me.nickname});
      nav.pop();
    } else {
      // 새 글 → 작성한 글 상세로 바로 이동 (전체 목록으로 튀지 않게)
      const newId = await addPost({
        title,
        body,
        boardType,
        anonymous: finalAnonymous,
        images,
        author: finalAnonymous ? '익명' : me.nickname,
        region: me.region,
        school: me.school,
        regionCity: me.regionCity, // 지역별 게시판: 같은 시·군·구끼리 묶기 위한 거주지
      });
      nav.pop(); // 글쓰기 화면 닫고
      if (newId) nav.push({name: 'postDetail', id: newId}); // 방금 쓴 글 보여주기
    }
  }

  return (
    <Page
      title={editing ? '글 수정' : '글쓰기'}
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={handleSave}>
          {editing ? '수정 완료' : '등록하기'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="게시판">
          <select className={inputClass} value={boardType} onChange={(e) => setBoardType(e.target.value as BoardType)}>
            {boardOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label="제목">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        </Field>
        <Field label="내용">
          <textarea
            className={`${inputClass} h-40 resize-none`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="내용을 입력하세요"
          />
        </Field>
        <MultiImagePicker label="사진 첨부" max={5} values={images} onChange={setImages} />
        {/* 익명 게시판은 자동 익명이라 체크란을 숨깁니다. */}
        {isAnonBoard ? (
          <p className="text-sm text-gray-500">🔒 익명 게시판이라 자동으로 익명으로 작성돼요.</p>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            익명으로 작성하기
          </label>
        )}
      </div>
    </Page>
  );
}
