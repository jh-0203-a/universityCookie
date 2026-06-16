// ============================================================
// 채팅 관련 화면 모음입니다.
//  - ChatScreen : 채팅방 목록
//  - ChatRoom   : 채팅방 (메시지 보기 + 보내기)
// ============================================================
import {useEffect, useRef, useState, type ChangeEvent, type ReactNode} from 'react';
import {ImagePlus, LogOut, Lock, Menu, MessageCircle, Siren, Users, X} from 'lucide-react';
import {useStore} from './data';
import {useNav} from './nav';
import type {ChatMessage} from './types';
import {CHAT_PURPOSES, REPORT_REASONS} from './types';
import {Avatar, Empty, Field, ImagePicker, Page, PrimaryButton, fileToScaledDataUrl, inputClass} from './ui';

// 채팅 화면 공통 부품 (메시지 목록 + 입력칸 + 사진 보내기).
// 일반 채팅방과 모임 채팅이 함께 사용합니다.
export function ChatThread({
  title,
  onBack,
  headerRight,
  messages,
  onSend,
  onProfile,
  overlay,
}: {
  title: string;
  onBack: () => void;
  headerRight?: ReactNode;
  messages: ChatMessage[];
  onSend: (text: string, image?: string) => void;
  onProfile?: (m: {name?: string; avatar?: string}) => void; // 프로필 눌렀을 때
  overlay?: ReactNode; // 메뉴/팝업 등 Page 안에 같이 그릴 것
}) {
  const {me} = useStore();
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 메시지의 "내 것" 여부는 저장값(mine)이 아니라 "지금 로그인한 사람"과 보낸 사람을 비교해 정합니다.
  // (다른 계정으로 보면 남의 메시지가 왼쪽으로 가야 하므로)
  const isMine = (msg: ChatMessage) => (msg.senderName ? msg.senderName === me.nickname : msg.mine);

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onSend('', await fileToScaledDataUrl(file)); // 사진만 보내는 메시지
    e.target.value = ''; // 같은 사진을 또 고를 수 있도록 초기화
  }
  function handleSend() {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <Page
      title={title}
      onBack={onBack}
      headerRight={headerRight}
      footer={
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <button onClick={() => fileRef.current?.click()} className="flex-none text-gray-500" aria-label="사진 보내기">
            <ImagePlus size={22} />
          </button>
          <input
            className={`${inputClass} min-w-0 flex-1`}
            placeholder="메시지를 입력하세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <span className="flex-none">
            <PrimaryButton onClick={handleSend}>전송</PrimaryButton>
          </span>
        </div>
      }
    >
      <div className="space-y-3 p-4">
        {messages.length === 0 && <Empty text="첫 메시지를 보내보세요!" />}
        {messages.map((msg) => {
          const mine = isMine(msg);
          return (
          <div key={msg.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
            {!mine &&
              (onProfile ? (
                <button onClick={() => onProfile({name: msg.senderName, avatar: msg.senderAvatar})} aria-label="프로필 보기">
                  <Avatar src={msg.senderAvatar} size={36} />
                </button>
              ) : (
                <Avatar src={msg.senderAvatar} size={36} />
              ))}
            <div className="max-w-[75%]">
              {!mine && msg.senderName && <div className="mb-0.5 text-xs text-gray-500">{msg.senderName}</div>}
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${
                  mine ? 'bg-orange-500 text-white' : 'bg-white text-gray-800 shadow-sm'
                }`}
              >
                {msg.image && <img src={msg.image} alt="사진" className="mb-1 max-h-60 rounded-lg object-cover" />}
                {msg.text}
                <div className={`mt-0.5 text-[10px] ${mine ? 'text-orange-100' : 'text-gray-400'}`}>{msg.time}</div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {overlay}
    </Page>
  );
}

// ----- 채팅방 목록 (내 채팅 / 둘러보기 두 탭) -----
export function ChatScreen() {
  const {rooms, me, openRooms, refreshOpenRooms, joinRoom} = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'mine' | 'browse'>('mine'); // 내 채팅 / 둘러보기

  // 둘러보기 탭을 열 때마다 최신 목록을 받아옵니다.
  useEffect(() => {
    if (view === 'browse') refreshOpenRooms();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // 내가 참여한 방만 보여줍니다. (멤버 정보가 없는 예전 방은 일단 보이게)
  const myRooms = rooms
    .filter((r) => !r.members || r.members.some((m) => m.name === me.nickname))
    .filter((r) => r.name.includes(q.trim())); // 채팅방 이름 검색

  // 둘러보기: 아직 참여 안 한 목적 채팅방만
  const browseRooms = openRooms.filter((r) => r.name.includes(q.trim()));

  async function handleJoin(roomId: number) {
    // 채팅은 지역 인증(📍)을 받은 회원만 참여할 수 있어요.
    if (!me.regionVerified) {
      if (window.confirm('채팅 참여는 지역 인증(📍)을 받은 회원만 할 수 있어요. 인증하러 갈까요?')) {
        nav.push({name: 'verify'});
      }
      return;
    }
    const r = await joinRoom(roomId);
    if (!r.ok) {
      window.alert(r.error ?? '참여하지 못했어요.');
      return;
    }
    nav.push({name: 'chatRoom', id: roomId});
  }

  return (
    <div className="p-4">
      {/* 내 채팅 / 둘러보기 전환 */}
      <div className="mb-3 flex gap-2">
        {([['mine', '내 채팅'], ['browse', '둘러보기']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
              view === key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 채팅방 검색 */}
      <input
        className={`${inputClass} mb-3`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 채팅방 검색"
      />

      {view === 'mine' ? (
        myRooms.length === 0 ? (
          <Empty text={q ? '검색 결과가 없어요.' : '아직 채팅방이 없어요. + 버튼으로 만들거나 둘러보기에서 참여해보세요!'} />
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {myRooms.map((room, i) => {
              const last = room.messages[room.messages.length - 1];
              return (
                <button
                  key={room.id}
                  onClick={() => nav.push({name: 'chatRoom', id: room.id})}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 ${
                    i !== myRooms.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-orange-100 text-orange-500">
                    <MessageCircle size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">
                        {room.name}
                        {room.purpose && (
                          <span className="ml-1 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">
                            {room.purpose}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">{last?.time ?? ''}</span>
                    </div>
                    <p className="truncate text-sm text-gray-500">{last?.text ?? '대화를 시작해보세요'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : browseRooms.length === 0 ? (
        <Empty text={q ? '검색 결과가 없어요.' : '아직 참여할 수 있는 채팅방이 없어요. + 버튼으로 만들어보세요!'} />
      ) : (
        <div className="space-y-2">
          {browseRooms.map((room) => {
            const full = room.count >= room.capacity; // 정원 마감
            return (
              <div key={room.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-orange-100 text-orange-500">
                  <MessageCircle size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {room.name}
                    <span className="ml-1 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">{room.purpose}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                    <Users size={12} /> {room.count}/{room.capacity}명
                  </p>
                </div>
                {room.joinedByMe ? (
                  <button
                    onClick={() => nav.push({name: 'chatRoom', id: room.id})}
                    className="flex-none rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600"
                  >
                    입장
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoin(room.id)}
                    disabled={full}
                    className={`flex-none rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      full ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white active:bg-orange-600'
                    }`}
                  >
                    {full ? '마감' : '참여'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----- 목적 채팅방 개설 -----
export function ChatNew() {
  const {me, createRoom} = useStore();
  const nav = useNav();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState<string>(CHAT_PURPOSES[0]);
  const [capacity, setCapacity] = useState('20');

  // 지역 인증(📍)을 안 받았으면 개설을 막고 안내합니다.
  if (!me.regionVerified) {
    return (
      <Page title="채팅방 만들기" onBack={nav.pop}>
        <div className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-500">
            <Lock size={26} />
          </div>
          <p className="text-base font-semibold text-gray-900">지역 인증이 필요해요</p>
          <p className="text-sm text-gray-500">채팅방 개설·참여는 지역 인증(📍)을 받은 회원만 할 수 있어요.</p>
          <PrimaryButton full onClick={() => nav.push({name: 'verify'})}>
            지역 인증하러 가기
          </PrimaryButton>
        </div>
      </Page>
    );
  }

  async function handleCreate() {
    if (!name.trim()) {
      window.alert('채팅방 이름을 입력해 주세요.');
      return;
    }
    const cap = Number(capacity) || 0;
    if (cap < 2 || cap > 100) {
      window.alert('인원수는 2명 이상 100명 이하로 정해 주세요.');
      return;
    }
    const id = await createRoom(name.trim(), purpose, cap);
    if (!id) {
      window.alert('채팅방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    nav.pop();
    nav.push({name: 'chatRoom', id});
  }

  return (
    <Page
      title="채팅방 만들기"
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={handleCreate}>
          개설하기
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="채팅방 목적">
          <div className="grid grid-cols-3 gap-2">
            {CHAT_PURPOSES.map((p) => (
              <button
                key={p}
                onClick={() => setPurpose(p)}
                className={`rounded-lg py-2 text-sm font-medium ${
                  purpose === p ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="채팅방 이름">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 주말 한강 러닝 모임"
          />
        </Field>
        <Field label="인원수 제한 (2~100명)">
          <input
            className={inputClass}
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            min={2}
            max={100}
            placeholder="20"
          />
        </Field>
        <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
          개설하면 내가 방장으로 첫 참여자가 되고, ‘둘러보기’에서 다른 회원들이 정원까지 참여할 수 있어요.
        </p>
      </div>
    </Page>
  );
}

// ----- 채팅방 (대화 화면) -----
export function ChatRoom({id}: {id: number}) {
  const {rooms, sendMessage} = useStore();
  const nav = useNav();
  const [menuOpen, setMenuOpen] = useState(false); // 오른쪽 메뉴(삼선) 열림 여부
  const [info, setInfo] = useState<{name?: string; avatar?: string} | null>(null); // 프로필 눌렀을 때 보여줄 사람
  const room = rooms.find((r) => r.id === id);

  if (!room) {
    return (
      <Page title="채팅" onBack={nav.pop}>
        <Empty text="없는 채팅방이에요." />
      </Page>
    );
  }

  return (
    <ChatThread
      title={room.name}
      onBack={nav.pop}
      messages={room.messages}
      onSend={(text, image) => sendMessage(id, text, image)}
      onProfile={(m) => setInfo(m)}
      // 헤더 오른쪽 삼선 버튼: 누르면 채팅방 메뉴가 열립니다.
      headerRight={
        <button onClick={() => setMenuOpen(true)} aria-label="채팅방 메뉴">
          <Menu size={22} />
        </button>
      }
      overlay={
        <>
          {/* 채팅방 메뉴 (인원 목록 + 신고/나가기) */}
          {menuOpen && (
            <RoomMenu
              roomId={id}
              onClose={() => setMenuOpen(false)}
              onSelectMember={(m) => setInfo({name: m.name, avatar: m.avatar})}
            />
          )}
          {/* 프로필을 눌렀을 때 뜨는 사용자 정보 팝업 */}
          {info && <MemberInfoModal name={info.name} avatar={info.avatar} onClose={() => setInfo(null)} />}
        </>
      }
    />
  );
}

// ----- 사용자 정보 팝업 (프로필 사진을 눌렀을 때) -----
function MemberInfoModal({name, avatar, onClose}: {name?: string; avatar?: string; onClose: () => void}) {
  const {users} = useStore();
  // 닉네임으로 회원 정보를 찾아봅니다. (없으면 익명으로 표시)
  const account = name ? users.find((u) => u.nickname === name) : undefined;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 익명이어도 사진은 그대로 보여줍니다. */}
        <div className="flex justify-center">
          <Avatar src={avatar} size={88} />
        </div>
        <p className="mt-3 text-lg font-semibold text-gray-900">{name ?? '익명'}</p>
        {account ? (
          <p className="mt-1 text-sm text-gray-500">
            {account.school} · {account.region}
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-400">익명 사용자</p>
        )}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ----- 채팅방 메뉴 (오른쪽에서 열리는 패널) -----
function RoomMenu({
  roomId,
  onClose,
  onSelectMember,
}: {
  roomId: number;
  onClose: () => void;
  onSelectMember: (m: {name: string; avatar?: string}) => void;
}) {
  const {rooms, leaveRoom, addReport} = useStore();
  const nav = useNav();
  const [reporting, setReporting] = useState(false); // 신고 모달 열림 여부
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const members = room.members ?? []; // 예전에 저장된 방에는 인원 정보가 없을 수 있어요.

  function handleLeave() {
    if (window.confirm('정말 이 채팅방을 나갈까요?')) {
      leaveRoom(roomId);
      nav.pop(); // 채팅방을 닫고 목록으로 돌아갑니다.
    }
  }

  return (
    // 반투명 배경. 빈 곳을 누르면 메뉴가 닫힙니다.
    <div className="absolute inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      {/* 오른쪽 패널 (안쪽 클릭은 닫히지 않도록 막아줍니다) */}
      <div className="flex h-full w-72 flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-semibold text-gray-900">채팅방 정보</span>
          <button onClick={onClose} aria-label="닫기" className="text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* 참여 인원 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-sm font-medium text-gray-700">참여 인원 {members.length}명</p>
          <div className="space-y-2">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelectMember(m)}
                className="flex w-full items-center gap-2 text-left active:opacity-70"
              >
                <Avatar src={m.avatar} size={32} />
                <span className="text-sm text-gray-800">{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 맨 아래: 신고하기 / 나가기 */}
        <div className="border-t border-gray-100">
          <button
            onClick={() => setReporting(true)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 active:bg-gray-50"
          >
            <Siren size={18} /> 신고하기
          </button>
          <button
            onClick={handleLeave}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-500 active:bg-gray-50"
          >
            <LogOut size={18} /> 나가기
          </button>
        </div>
      </div>

      {/* 채팅방 신고 모달 (누구를 신고할지 + 증거 사진 첨부) */}
      {reporting && (
        <ChatReportModal
          members={room.members ?? []}
          onClose={() => setReporting(false)}
          onSubmit={(targetUser, reason, image) => {
            addReport('채팅방', room.name, reason, targetUser, roomId, image);
            window.alert('신고가 접수되었어요. 관리자 확인 후 조치하겠습니다.');
          }}
        />
      )}
    </div>
  );
}

// ----- 채팅 신고 모달 (대상자 선택 + 증거 사진 첨부 + 사유) -----
// 일반 채팅방과 모임 채팅이 함께 사용합니다.
export function ChatReportModal({
  members,
  onClose,
  onSubmit,
}: {
  members: {id: number; name: string; avatar?: string}[];
  onClose: () => void;
  onSubmit: (targetUser: string, reason: string, image: string | undefined) => void;
}) {
  const {me} = useStore();
  const others = members.filter((m) => m.name !== me.nickname); // 나 빼고
  const [target, setTarget] = useState(others[0]?.name ?? '');
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [etc, setEtc] = useState('');
  const [image, setImage] = useState<string>();

  function handleSubmit() {
    if (!target) {
      window.alert('신고할 사람을 선택해 주세요.');
      return;
    }
    const finalReason = reason === '기타' ? etc.trim() : reason;
    if (!finalReason) {
      window.alert('신고 사유를 입력해 주세요.');
      return;
    }
    onSubmit(target, finalReason, image);
    onClose();
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[85%] w-full overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-base font-bold text-gray-900">채팅방 신고</p>

        {/* 1) 누구를 신고하나요 */}
        <p className="mb-1 text-sm font-medium text-gray-700">누구를 신고하나요?</p>
        <div className="mb-3 space-y-1">
          {others.length === 0 && <p className="text-sm text-gray-400">신고할 상대가 없어요.</p>}
          {others.map((m) => (
            <label key={m.id} className="flex items-center gap-2 py-1 text-sm text-gray-800">
              <input type="radio" name="report-target" checked={target === m.name} onChange={() => setTarget(m.name)} />
              {m.name}
            </label>
          ))}
        </div>

        {/* 2) 사유 */}
        <p className="mb-1 text-sm font-medium text-gray-700">신고 사유</p>
        <div className="space-y-1">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 py-1 text-sm text-gray-800">
              <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        {reason === '기타' && (
          <input className={`${inputClass} mt-1`} value={etc} onChange={(e) => setEtc(e.target.value)} placeholder="신고 사유를 입력하세요" />
        )}

        {/* 3) 증거 사진 첨부 (선택) — 문제가 된 대화 스크린샷 */}
        <div className="mt-3">
          <ImagePicker label="증거 사진 (선택) · 문제 대화 캡처" value={image} onChange={setImage} />
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
            취소
          </button>
          <button onClick={handleSubmit} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white">
            신고하기
          </button>
        </div>
      </div>
    </div>
  );
}
