// ============================================================
// 모임 관련 화면 모음입니다.
//  - MeetupScreen : 모임 목록
//  - MeetupDetail : 모임 상세 (참가/취소 / 수정 / 삭제)
//  - MeetupForm   : 모임 만들기 / 수정
// ============================================================
import {useState} from 'react';
import {ChevronRight, HandHeart, MessageCircle, Megaphone, Trash2} from 'lucide-react';
import {useStore} from './data';
import {useNav} from './nav';
import {ChatThread, ChatReportModal} from './Chat';
import {CommentThread} from './Comments';
import type {PollOption} from './types';
import {Empty, Field, GhostButton, Page, PrimaryButton, ReportModal, VerifiedBadges, inputClass} from './ui';

// ----- 모임 목록 -----
export function MeetupScreen() {
  const {meetups} = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');

  // 모임 이름/장소로 검색
  const visible = meetups.filter((m) => (m.title + m.place).includes(q.trim()));

  return (
    <div className="p-4">
      {/* 모임 검색 */}
      <input
        className={`${inputClass} mb-3`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 모임 검색 (이름·장소)"
      />

      {meetups.length === 0 ? (
        <Empty text="아직 모임이 없어요. + 버튼으로 모임을 만들어보세요!" />
      ) : visible.length === 0 ? (
        <Empty text="검색 결과가 없어요." />
      ) : (
        <div className="space-y-3">
          {visible.map((m) => (
            <button
              key={m.id}
              onClick={() => nav.push({name: 'meetupDetail', id: m.id})}
              className="block w-full rounded-xl bg-white p-4 text-left shadow-sm active:bg-gray-50"
            >
              <h2 className="font-semibold text-gray-900">
                {m.title}
                {m.requireApproval && <span className="ml-1 text-xs text-gray-400">🔒승인제</span>}
              </h2>
              <p className="mt-1 text-sm text-gray-500">👤 모임장: {m.host ?? '알 수 없음'}</p>
              <p className="text-sm text-gray-500">🗓 {m.when}</p>
              <p className="text-sm text-gray-500">📍 {m.place}</p>
              <p className="mt-2 text-sm text-orange-500">
                {m.joined}/{m.capacity}명 참여중 {m.joinedByMe && '· 참여중 ✅'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- 모임 상세 -----
export function MeetupDetail({id}: {id: number}) {
  const {meetups, me, toggleJoin, requestJoin, cancelJoinRequest, approveJoinRequest, rejectJoinRequest, deleteMeetup, addReport} =
    useStore();
  const nav = useNav();
  const [reporting, setReporting] = useState(false); // 신고 모달 열림 여부
  const [applying, setApplying] = useState(false); // 가입 신청(소개 입력) 모달
  const [intro, setIntro] = useState('');
  const m = meetups.find((x) => x.id === id);
  const isHost = m?.host === me.nickname; // 내가 모임장인지
  const myRequest = (m?.joinRequests ?? []).find((r) => r.applicant === me.nickname); // 내 가입 신청
  const requests = m?.joinRequests ?? [];

  if (!m) {
    return (
      <Page title="모임" onBack={nav.pop}>
        <Empty text="삭제되었거나 없는 모임이에요." />
      </Page>
    );
  }

  function handleDelete() {
    if (window.confirm('이 모임을 삭제할까요?')) {
      deleteMeetup(id);
      nav.pop();
    }
  }

  return (
    <Page
      title="모임 상세"
      onBack={nav.pop}
      // 모임장이면 수정/삭제, 그 외 사람에겐 신고 버튼을 보여줍니다.
      headerRight={
        isHost ? (
          <>
            <button onClick={() => nav.push({name: 'meetupForm', id})} className="text-sm text-gray-600">
              수정
            </button>
            <button onClick={handleDelete} className="text-sm text-red-500">
              삭제
            </button>
          </>
        ) : (
          <button onClick={() => setReporting(true)} className="text-sm text-red-500">
            신고
          </button>
        )
      }
      footer={
        m.joinedByMe ? (
          <GhostButton full onClick={() => toggleJoin(id)}>
            참가 취소하기
          </GhostButton>
        ) : m.requireApproval && !isHost ? (
          // 승인제 모임: 가입 신청 → 모임장 승인 필요
          myRequest ? (
            <GhostButton full onClick={() => cancelJoinRequest(id)}>
              승인 대기 중 · 신청 취소
            </GhostButton>
          ) : (
            <PrimaryButton full onClick={() => setApplying(true)}>
              가입 신청하기
            </PrimaryButton>
          )
        ) : (
          <PrimaryButton full onClick={() => toggleJoin(id)}>
            참가하기
          </PrimaryButton>
        )
      }
    >
      <div className="space-y-3 p-4">
        <h2 className="text-xl font-bold text-gray-900">{m.title}</h2>
        <div className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm">
          <p className="flex items-center gap-1">
            👤 모임장: <b className="text-gray-800">{m.host ?? '알 수 없음'}</b>
            {m.host && <VerifiedBadges nickname={m.host} />}
          </p>
          <p>🗓 일정: {m.when}</p>
          <p>📍 장소: {m.place}</p>
          <p className="text-orange-500">
            👥 참여: {m.joined}/{m.capacity}명
          </p>
          {m.requireApproval && <p className="mt-1 text-xs text-gray-500">🔒 모임장 승인이 필요한 모임이에요.</p>}
        </div>

        {/* 모임장: 가입 신청 심사 (신청자 정보 + 소개를 보고 승인/거절) */}
        {isHost && m.requireApproval && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <p className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-800">가입 신청 {requests.length}</p>
            {requests.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">아직 가입 신청이 없어요.</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-gray-900">{r.applicant}</span>
                    <VerifiedBadges nickname={r.applicant} />
                    <span className="text-xs text-gray-400">
                      {r.school}
                      {r.region && ` · ${r.region}`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{r.intro || '(소개 없음)'}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => rejectJoinRequest(id, r.id)}
                      className="flex-1 rounded-lg border border-gray-300 py-1.5 text-sm font-medium text-gray-700"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => approveJoinRequest(id, r.id)}
                      className="flex-1 rounded-lg bg-orange-500 py-1.5 text-sm font-semibold text-white"
                    >
                      승인
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 참여 중일 때만 모임 게시판/채팅에 들어갈 수 있어요. */}
        {m.joinedByMe ? (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <p className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-green-600">✅ 참여 중인 모임</p>
            <button
              onClick={() => nav.push({name: 'meetupBoard', id})}
              className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left active:bg-gray-50"
            >
              <Megaphone size={20} className="text-orange-500" />
              <span className="flex-1 text-gray-800">모임 게시판 · 공지</span>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button
              onClick={() => nav.push({name: 'meetupChat', id})}
              className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left active:bg-gray-50"
            >
              <MessageCircle size={20} className="text-orange-500" />
              <span className="flex-1 text-gray-800">모임 단체 채팅</span>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button
              onClick={() => nav.push({name: 'meetupGreetings', id})}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50"
            >
              <HandHeart size={20} className="text-orange-500" />
              <span className="flex-1 text-gray-800">가입 인사</span>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">참가하면 모임 게시판과 단체 채팅을 이용할 수 있어요.</p>
        )}
      </div>

      {/* 신고 모달 */}
      {reporting && (
        <ReportModal
          who={m.host}
          onClose={() => setReporting(false)}
          onSubmit={(reason) => {
            addReport('모임', m.title, reason, m.host, id);
            window.alert('신고가 접수되었어요. 관리자 확인 후 조치하겠습니다.');
          }}
        />
      )}

      {/* 가입 신청(소개 입력) 모달 — 승인제 모임 */}
      {applying && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setApplying(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-gray-900">가입 신청</p>
            <p className="mt-1 text-xs text-gray-500">모임장이 회원 정보와 아래 소개를 보고 승인 여부를 결정해요.</p>
            <textarea
              className={`${inputClass} mt-3 h-28 resize-none`}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="간단한 자기소개 / 가입하고 싶은 이유를 적어주세요."
            />
            <div className="mt-3 flex gap-2">
              <GhostButton full onClick={() => setApplying(false)}>
                취소
              </GhostButton>
              <PrimaryButton
                full
                onClick={() => {
                  requestJoin(id, intro.trim());
                  setApplying(false);
                  setIntro('');
                  window.alert('가입 신청을 보냈어요. 모임장 승인을 기다려 주세요.');
                }}
              >
                신청하기
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

// ----- 모임 게시판 (공지 + 게시글 작성/목록) -----
export function MeetupBoard({id}: {id: number}) {
  const {meetups, me, addMeetupPost, deleteMeetupPost, addMeetupPostComment, deleteMeetupPostComment} = useStore();
  const nav = useNav();
  const m = meetups.find((x) => x.id === id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState(false);
  const [usePoll, setUsePoll] = useState(false); // 투표 추가 여부
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']); // 투표 선택지(처음 2칸)

  if (!m) {
    return (
      <Page title="모임 게시판" onBack={nav.pop}>
        <Empty text="없는 모임이에요." />
      </Page>
    );
  }
  const posts = m.posts ?? [];

  function handleAdd() {
    if (!title.trim()) {
      window.alert('제목을 입력해 주세요.');
      return;
    }
    // 투표를 켰으면 빈 칸을 빼고 2개 이상인지 확인
    const poll = usePoll ? pollOptions.map((o) => o.trim()).filter(Boolean) : [];
    if (usePoll && poll.length < 2) {
      window.alert('투표 선택지를 2개 이상 입력해 주세요.');
      return;
    }
    addMeetupPost(id, {title: title.trim(), body: body.trim(), notice, poll: poll.length >= 2 ? poll : undefined});
    setTitle('');
    setBody('');
    setNotice(false);
    setUsePoll(false);
    setPollOptions(['', '']);
  }

  return (
    <Page title={`${m.title} · 게시판`} onBack={nav.pop}>
      <div className="space-y-4 p-4">
        {/* 글/공지 작성 */}
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <Field label="제목">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
          </Field>
          <Field label="내용">
            <textarea
              className={`${inputClass} h-24 resize-none`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="내용을 입력하세요"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={notice} onChange={(e) => setNotice(e.target.checked)} />
            공지글로 등록하기
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={usePoll} onChange={(e) => setUsePoll(e.target.checked)} />
            📊 투표 추가하기
          </label>
          {/* 투표 선택지 입력 (2~5개) */}
          {usePoll && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-3">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    value={opt}
                    placeholder={`선택지 ${i + 1}`}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                      className="flex-none px-2 text-gray-400"
                      aria-label="선택지 삭제"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-sm font-medium text-orange-500">
                  + 선택지 추가
                </button>
              )}
            </div>
          )}
          <PrimaryButton full onClick={handleAdd}>
            등록하기
          </PrimaryButton>
        </div>

        {/* 글 목록 (공지글이 위로 오도록 정렬) */}
        {posts.length === 0 ? (
          <Empty text="아직 글이 없어요. 첫 글을 남겨보세요!" />
        ) : (
          <div className="space-y-2">
            {[...posts]
              .sort((a, b) => Number(b.notice) - Number(a.notice))
              .map((p) => (
                <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {p.notice && <span className="mr-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-600">공지</span>}
                        {p.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.author} · {p.createdAt}
                      </p>
                    </div>
                    {/* 글 삭제는 내 글이거나 관리자만 */}
                    {(p.author === me.nickname || me.role === '관리자') && (
                      <button onClick={() => deleteMeetupPost(id, p.id)} className="text-gray-300" aria-label="글 삭제">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {p.body && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{p.body}</p>}
                  {/* 투표가 있으면 결과/참여 UI */}
                  {p.poll && p.poll.length > 0 && <PollView meetupId={id} postId={p.id} options={p.poll} />}
                  {/* 댓글 + 대댓글(답글) */}
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <CommentThread
                      comments={p.comments}
                      meNick={me.nickname}
                      isAdmin={me.role === '관리자'}
                      onAdd={(body, parentId) => addMeetupPostComment(id, p.id, body, parentId)}
                      onDelete={(cid) => deleteMeetupPostComment(id, cid)}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </Page>
  );
}

// 모임 게시글 투표 보기/참여 부품.
//  - 선택지를 누르면 투표(같은 선택지 다시 누르면 취소)되고, 막대·득표수·퍼센트로 결과가 보입니다.
function PollView({meetupId, postId, options}: {meetupId: number; postId: number; options: PollOption[]}) {
  const {voteMeetupPoll} = useStore();
  const total = options.reduce((sum, o) => sum + o.votes, 0);
  return (
    <div className="mt-2 space-y-1.5">
      {options.map((o) => {
        const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
        return (
          <button
            key={o.id}
            onClick={() => voteMeetupPoll(meetupId, postId, o.id)}
            className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left ${
              o.votedByMe ? 'border-orange-400' : 'border-gray-200'
            }`}
          >
            {/* 득표 비율만큼 채워지는 막대 */}
            <div className="absolute inset-y-0 left-0 bg-orange-100" style={{width: `${pct}%`}} />
            <div className="relative flex items-center justify-between text-sm">
              <span className={o.votedByMe ? 'font-semibold text-orange-700' : 'text-gray-700'}>
                {o.votedByMe && '✓ '}
                {o.label}
              </span>
              <span className="flex-none text-xs text-gray-500">
                {o.votes}표 · {pct}%
              </span>
            </div>
          </button>
        );
      })}
      <p className="text-xs text-gray-400">총 {total}표 · 선택지를 누르면 투표돼요 (다시 누르면 취소)</p>
    </div>
  );
}

// ----- 모임 단체 채팅 -----
export function MeetupChat({id}: {id: number}) {
  const {meetups, me, sendMeetupMessage, addReport} = useStore();
  const nav = useNav();
  const [reporting, setReporting] = useState(false);
  const m = meetups.find((x) => x.id === id);

  if (!m) {
    return (
      <Page title="모임 채팅" onBack={nav.pop}>
        <Empty text="없는 모임이에요." />
      </Page>
    );
  }

  const messages = m.messages ?? [];
  // 신고 대상 후보: 채팅을 보낸 사람들(나 제외)을 닉네임 기준으로 모읍니다.
  const memberNames = Array.from(
    new Set(messages.filter((msg) => msg.senderName && msg.senderName !== me.nickname).map((msg) => msg.senderName as string)),
  );
  const members = memberNames.map((name, i) => ({id: i, name}));

  // 일반 채팅과 똑같은 화면 부품을 재사용합니다. (사진 첨부 + 신고 포함)
  return (
    <ChatThread
      title={`${m.title} · 채팅`}
      onBack={nav.pop}
      messages={messages}
      onSend={(text, image) => sendMeetupMessage(id, text, image)}
      headerRight={
        <button onClick={() => setReporting(true)} className="text-sm text-red-500">
          신고
        </button>
      }
      overlay={
        reporting && (
          <ChatReportModal
            members={members}
            onClose={() => setReporting(false)}
            onSubmit={(targetUser, reason, image) => {
              addReport('모임', `${m.title} 채팅`, reason, targetUser, id, image);
              window.alert('신고가 접수되었어요. 관리자 확인 후 조치하겠습니다.');
            }}
          />
        )
      }
    />
  );
}

// ----- 모임 가입 인사 -----
export function MeetupGreetings({id}: {id: number}) {
  const {meetups, addMeetupGreeting} = useStore();
  const nav = useNav();
  const m = meetups.find((x) => x.id === id);
  const [body, setBody] = useState('');

  if (!m) {
    return (
      <Page title="가입 인사" onBack={nav.pop}>
        <Empty text="없는 모임이에요." />
      </Page>
    );
  }
  const greetings = m.greetings ?? [];

  function handleAdd() {
    if (!body.trim()) {
      window.alert('인사말을 입력해 주세요.');
      return;
    }
    addMeetupGreeting(id, body.trim());
    setBody('');
  }

  return (
    <Page
      title={`${m.title} · 가입 인사`}
      onBack={nav.pop}
      footer={
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="가입 인사를 남겨보세요"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <PrimaryButton onClick={handleAdd}>등록</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-2 p-4">
        {greetings.length === 0 ? (
          <Empty text="아직 가입 인사가 없어요. 첫 인사를 남겨보세요! 👋" />
        ) : (
          greetings.map((g) => (
            <div key={g.id} className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-400">
                {g.author} · {g.createdAt}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{g.body}</p>
            </div>
          ))
        )}
      </div>
    </Page>
  );
}

// ----- 모임 만들기 / 수정 -----
export function MeetupForm({id}: {id?: number}) {
  const {meetups, addMeetup, updateMeetup} = useStore();
  const nav = useNav();
  const editing = meetups.find((x) => x.id === id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [when, setWhen] = useState(editing?.when ?? '');
  const [place, setPlace] = useState(editing?.place ?? '');
  const [capacity, setCapacity] = useState(String(editing?.capacity ?? 10));
  const [requireApproval, setRequireApproval] = useState(editing?.requireApproval ?? false);

  function handleSave() {
    if (!title.trim()) {
      window.alert('모임 이름을 입력해 주세요.');
      return;
    }
    const cap = Number(capacity) || 1;
    if (editing) {
      updateMeetup(editing.id, {title, when, place, capacity: cap, requireApproval});
    } else {
      addMeetup({title, when, place, capacity: cap, requireApproval});
    }
    nav.pop();
  }

  return (
    <Page
      title={editing ? '모임 수정' : '모임 만들기'}
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={handleSave}>
          {editing ? '수정 완료' : '만들기'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="모임 이름">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 한강 러닝 모임" />
        </Field>
        <Field label="일정">
          <input className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="예: 6/15 (일) 오전 9시" />
        </Field>
        <Field label="장소">
          <input className={inputClass} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="예: 광교호수공원" />
        </Field>
        <Field label="모집 인원">
          <input
            className={inputClass}
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            min={1}
          />
        </Field>
        {/* 가입 승인제 설정 */}
        <label className="flex items-start gap-2 rounded-xl bg-white p-3 text-sm shadow-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-orange-500"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
          />
          <span>
            <span className="font-medium text-gray-800">가입 승인 받기</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              신청자가 소개를 적어 신청하고, 모임장이 회원 정보와 소개를 보고 승인/거절해요.
            </span>
          </span>
        </label>
      </div>
    </Page>
  );
}
