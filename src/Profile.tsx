// ============================================================
// 내 정보 관련 화면 모음입니다.
//  - ProfileScreen : 내 정보 + 메뉴 (프로필 수정 / 회원 관리 / 문의하기 ...)
//  - ProfileEdit   : 내 프로필(닉네임/학교/지역) 수정
//  - UsersScreen   : 회원 관리 목록 (사용자 CRUD)
//  - UserForm      : 회원 추가 / 수정
//  - InquiryScreen : 문의하기 (작성 / 목록 / 삭제)
// ============================================================
import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import {ChevronRight, LogOut, ShieldCheck, Trash2} from 'lucide-react';
import {useStore} from './data';
import {useNav} from './nav';
import {SUSPEND_PERIODS, type Report, type SuspendPeriod, type UserAccount} from './types';
import {Avatar, Empty, Field, MultiImagePicker, Page, PrimaryButton, RegionBadge, RegionSchoolPicker, SchoolBadge, fileToScaledDataUrl, inputClass} from './ui';

const STATUSES: UserAccount['status'][] = ['정상', '정지', '탈퇴'];

// 휴대폰 번호(숫자만 저장됨)를 010-1234-5678 형태로 보기 좋게 바꿔줍니다.
function formatPhone(phone?: string): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return phone ?? '';
}

// 정지 기간을 받아 "오늘부터 그만큼 뒤"의 날짜를 yyyy.mm.dd 로 돌려줍니다.
function untilDate(period: SuspendPeriod): string {
  const d = new Date();
  if (period === '1달') d.setMonth(d.getMonth() + 1);
  else if (period === '6달') d.setMonth(d.getMonth() + 6);
  else if (period === '1년') d.setFullYear(d.getFullYear() + 1);
  else if (period === '2년') d.setFullYear(d.getFullYear() + 2);
  else if (period === '5년') d.setFullYear(d.getFullYear() + 5);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

// ----- 내 정보 메인 -----
export function ProfileScreen() {
  const {me, logout, verifications, inquiries, reports} = useStore();
  const nav = useNav();

  function handleLogout() {
    if (window.confirm('로그아웃 할까요?')) logout();
  }

  // 관리자가 처리해야 할 "대기 중" 개수 (메뉴 옆 빨간 배지로 표시)
  const pendingVerifs = (verifications ?? []).filter((v) => v.status === '대기').length; // 심사 대기 인증
  const openInquiries = (inquiries ?? []).filter((i) => !i.answer).length; // 답변 안 한 문의
  const openReports = (reports ?? []).filter((r) => !r.handled).length; // 처리 안 한 신고

  // 메뉴 목록. 관리자/회원에 따라 다르게 보여줍니다. (badge = 옆에 띄울 알림 개수)
  const isAdmin = me.role === '관리자';
  const menus: {label: string; onClick: () => void; badge?: number}[] = [
    {label: '프로필 수정', onClick: () => nav.push({name: 'profileEdit'})},
    {label: '쪽지함', onClick: () => nav.push({name: 'notes'})},
    ...(isAdmin
      ? [
          // 관리자: 운영 기능
          {label: '회원 관리', onClick: () => nav.push({name: 'users' as const})},
          {label: '인증 요청', badge: pendingVerifs, onClick: () => nav.push({name: 'adminVerifications' as const})},
          {label: '문의 확인', badge: openInquiries, onClick: () => nav.push({name: 'adminInquiries' as const})},
          {label: '신고 확인', badge: openReports, onClick: () => nav.push({name: 'adminReports' as const})},
        ]
      : [
          // 일반 회원: 문의 작성
          {label: '문의하기', onClick: () => nav.push({name: 'inquiry' as const})},
        ]),
  ];

  return (
    <div className="space-y-3 p-4">
      {/* 내 프로필 카드 */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar src={me.avatar} size={56} />
          <div>
            <p className="font-semibold text-gray-900">
              {me.nickname}
              {me.role === '관리자' && (
                <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-600">관리자</span>
              )}
            </p>
            <p className="text-sm text-gray-500">
              {me.school}
              {me.gradYear && ` ${me.gradYear}년 졸업`} · {me.region}
            </p>
            {me.role === '관리자' ? (
              <p className="flex items-center gap-1 text-sm text-green-600">
                <ShieldCheck size={15} /> 청년와글 운영자
              </p>
            ) : (
              // 인증은 선택 → 한 것만 배지로 보여주고, 옆에 "인증하기/관리" 링크
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {me.verified && <SchoolBadge method={me.schoolMethod} school={me.school} />}
                {me.regionVerified && <RegionBadge />}
                <button onClick={() => nav.push({name: 'verify'})} className="text-xs font-medium text-orange-500 underline">
                  {me.verified && me.regionVerified ? '인증 관리' : '인증하기'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 메뉴 목록 */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {menus.map((menu, i) => (
          <button
            key={menu.label}
            onClick={menu.onClick}
            className={`flex w-full items-center justify-between px-4 py-4 text-left text-gray-800 active:bg-gray-50 ${
              i !== menus.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            <span>{menu.label}</span>
            <span className="flex items-center gap-2">
              {/* 처리 대기 개수 (0이면 안 보임) */}
              {menu.badge ? (
                <span className="min-w-[20px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-bold text-white">
                  {menu.badge}
                </span>
              ) : null}
              <ChevronRight size={18} className="text-gray-300" />
            </span>
          </button>
        ))}
      </div>

      {/* 로그아웃 */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-medium text-red-500 shadow-sm active:bg-gray-50"
      >
        <LogOut size={18} /> 로그아웃
      </button>
    </div>
  );
}

// ----- 프로필 수정 -----
export function ProfileEdit() {
  const {me, updateMe} = useStore();
  const nav = useNav();
  const [nickname, setNickname] = useState(me.nickname);
  const [school, setSchool] = useState(me.school);
  const [region, setRegion] = useState(me.region);
  const [avatar, setAvatar] = useState(me.avatar); // 프로필 사진 (이미지 주소)
  // 배지에 대학교명/지역명을 표시할지 (끄면 배지는 남고 이름만 숨겨짐)
  const [hideSchoolName, setHideSchoolName] = useState(me.hideSchoolName ?? false);
  const [hideRegionName, setHideRegionName] = useState(me.hideRegionName ?? false);
  const fileRef = useRef<HTMLInputElement>(null); // 숨겨둔 파일 선택 칸

  // 사진을 고르면 크기를 줄여(프로필은 작게) 화면에 미리 보여줍니다.
  async function handlePickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatar(await fileToScaledDataUrl(file, 400, 0.8)); // 프로필 사진은 400px 면 충분
  }

  function handleSave() {
    if (!nickname.trim()) {
      window.alert('닉네임을 입력해 주세요.');
      return;
    }
    // 닉네임은 30일에 한 번만 변경할 수 있어요.
    const changingNick = nickname.trim() !== me.nickname;
    if (changingNick && me.nicknameChangedAt) {
      const last = new Date(me.nicknameChangedAt);
      const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (days < 30) {
        const next = new Date(last.getTime() + 30 * 24 * 60 * 60 * 1000);
        const ymd = `${next.getFullYear()}.${String(next.getMonth() + 1).padStart(2, '0')}.${String(next.getDate()).padStart(2, '0')}`;
        window.alert(`닉네임은 30일에 한 번만 바꿀 수 있어요. ${ymd}부터 다시 변경할 수 있어요.`);
        return;
      }
    }
    updateMe({
      nickname: nickname.trim(),
      school,
      region,
      avatar,
      hideSchoolName,
      hideRegionName,
      ...(changingNick ? {nicknameChangedAt: new Date().toISOString()} : {}),
    });
    nav.pop();
  }

  return (
    <Page
      title="프로필 수정"
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={handleSave}>
          저장하기
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        {/* 프로필 사진 변경 */}
        <div className="flex flex-col items-center gap-2">
          <Avatar src={avatar} size={88} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
          <div className="flex gap-3 text-sm">
            <button onClick={() => fileRef.current?.click()} className="font-medium text-orange-500">
              사진 변경
            </button>
            {avatar && (
              <button onClick={() => setAvatar(undefined)} className="text-gray-400">
                사진 삭제
              </button>
            )}
          </div>
        </div>

        <Field label="닉네임">
          <input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </Field>

        {/* 생년월일·휴대폰 번호: 휴대폰 본인인증으로 확인된 정보라 여기서 직접 못 바꿔요. */}
        <Field label="생년월일">
          <input className={`${inputClass} bg-gray-50 text-gray-500`} value={me.birth || '미설정'} disabled readOnly />
        </Field>
        <Field label="휴대폰 번호">
          <input className={`${inputClass} bg-gray-50 text-gray-500`} value={formatPhone(me.phone) || '미설정'} disabled readOnly />
        </Field>
        <p className="-mt-1 text-xs text-gray-400">📱 생년월일·휴대폰 번호는 본인인증으로 확인된 정보예요.</p>

        {/* 거주 지역은 인증 정보라 고정. 변경하려면 지역 재인증으로만 가능. 학교는 수정 가능. */}
        <RegionSchoolPicker
          region={region}
          school={school}
          lockRegion
          regionCity={me.regionCity}
          regionVerified={me.regionVerified === true}
          onReverify={() => nav.push({name: 'verify'})}
          onChange={(r, s) => {
            setRegion(r);
            setSchool(s);
          }}
        />

        {/* 배지 표시 설정: 인증 배지 옆에 대학교명/지역명을 보일지 끌 수 있어요. */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-gray-700">배지 표시 설정</p>
          <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
            <input type="checkbox" checked={hideSchoolName} onChange={(e) => setHideSchoolName(e.target.checked)} />
            대학교명 숨기기 (🎓 배지에서 학교 이름 감춤)
          </label>
          <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
            <input type="checkbox" checked={hideRegionName} onChange={(e) => setHideRegionName(e.target.checked)} />
            지역명 숨기기 (📍 배지에서 지역 이름 감춤)
          </label>
        </div>
      </div>
    </Page>
  );
}

// ----- 회원 관리 목록 (사용자 CRUD) -----
export function UsersScreen() {
  const {users, deleteUser} = useStore();
  const nav = useNav();

  function handleDelete(u: UserAccount) {
    if (window.confirm(`'${u.nickname}' 회원을 삭제할까요?`)) {
      deleteUser(u.id);
    }
  }

  return (
    <Page
      title="회원 관리"
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={() => nav.push({name: 'userForm'})}>
          회원 추가
        </PrimaryButton>
      }
    >
      {users.length === 0 ? (
        <Empty text="회원이 없어요." />
      ) : (
        <div className="space-y-2 p-4">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">
                  {u.nickname}
                  <StatusBadge status={u.status} />
                </p>
                <p className="truncate text-xs text-gray-400">
                  {u.email} · {u.school}
                </p>
                {/* 정지 회원이면 사유와 정지 기간(해제 예정일)을 보여줍니다. */}
                {u.status === '정지' && (
                  <p className="mt-0.5 text-xs text-yellow-700">
                    ⛔ {u.suspendReason || '사유 미입력'}
                    {u.suspendPeriod && ` · ${u.suspendPeriod} 정지`}
                    {u.suspendUntil && ` (${u.suspendUntil}까지)`}
                  </p>
                )}
              </div>
              <button onClick={() => nav.push({name: 'userForm', id: u.id})} className="text-sm text-gray-500">
                수정
              </button>
              <button onClick={() => handleDelete(u)} className="text-red-400" aria-label="회원 삭제">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

function StatusBadge({status}: {status: UserAccount['status']}) {
  const color = status === '정상' ? 'text-green-600' : status === '정지' ? 'text-yellow-600' : 'text-gray-400';
  return <span className={`ml-2 text-xs ${color}`}>· {status}</span>;
}

// ----- 회원 추가 / 수정 -----
export function UserForm({id}: {id?: number}) {
  const {users, addUser, updateUser} = useStore();
  const nav = useNav();
  const editing = users.find((u) => u.id === id);

  const [nickname, setNickname] = useState(editing?.nickname ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [school, setSchool] = useState(editing?.school ?? '');
  const [region, setRegion] = useState(editing?.region ?? '');
  const [status, setStatus] = useState<UserAccount['status']>(editing?.status ?? '정상');
  const [suspendReason, setSuspendReason] = useState(editing?.suspendReason ?? '');
  const [suspendPeriod, setSuspendPeriod] = useState<SuspendPeriod>(editing?.suspendPeriod ?? '1달');

  function handleSave() {
    if (!nickname.trim()) {
      window.alert('닉네임을 입력해 주세요.');
      return;
    }
    // 정지 상태이면 사유/기간/해제일을 함께 저장하고, 그 외 상태면 정지 정보를 비웁니다.
    const suspendInfo =
      status === '정지'
        ? {suspendReason, suspendPeriod, suspendUntil: untilDate(suspendPeriod)}
        : {suspendReason: undefined, suspendPeriod: undefined, suspendUntil: undefined};
    const data = {nickname, email, school, region, status, ...suspendInfo};
    if (editing) {
      updateUser(editing.id, data);
    } else {
      addUser(data);
    }
    nav.pop();
  }

  return (
    <Page
      title={editing ? '회원 수정' : '회원 추가'}
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={handleSave}>
          {editing ? '수정 완료' : '추가하기'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="닉네임">
          <input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </Field>
        <Field label="이메일">
          <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="@학교.ac.kr" />
        </Field>
        <Field label="학교">
          <input className={inputClass} value={school} onChange={(e) => setSchool(e.target.value)} />
        </Field>
        <Field label="지역">
          <input className={inputClass} value={region} onChange={(e) => setRegion(e.target.value)} />
        </Field>
        <Field label="상태">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as UserAccount['status'])}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        {/* 상태가 '정지'일 때만 정지 사유 / 정지 기간을 입력받습니다. */}
        {status === '정지' && (
          <>
            <Field label="정지 사유">
              <input
                className={inputClass}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="예: 스팸/광고 게시물"
              />
            </Field>
            <Field label="정지 기간">
              <select
                className={inputClass}
                value={suspendPeriod}
                onChange={(e) => setSuspendPeriod(e.target.value as SuspendPeriod)}
              >
                {SUSPEND_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-gray-400">해제 예정일: {untilDate(suspendPeriod)}</p>
          </>
        )}
      </div>
    </Page>
  );
}

// ----- 문의하기 -----
export function InquiryScreen() {
  const {inquiries, addInquiry, deleteInquiry} = useStore();
  const nav = useNav();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);

  function handleSubmit() {
    if (!title.trim()) {
      window.alert('문의 제목을 입력해 주세요.');
      return;
    }
    addInquiry(title.trim(), body.trim(), images);
    setTitle('');
    setBody('');
    setImages([]);
    window.alert('문의가 접수되었어요. 빠르게 답변드릴게요!');
  }

  return (
    <Page title="문의하기" onBack={nav.pop}>
      <div className="space-y-4 p-4">
        {/* 문의 작성 */}
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <Field label="제목">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="무엇이 궁금하신가요?" />
          </Field>
          <Field label="내용">
            <textarea
              className={`${inputClass} h-28 resize-none`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="자세한 내용을 적어주세요"
            />
          </Field>
          <MultiImagePicker label="사진 첨부" max={5} values={images} onChange={setImages} />
          <PrimaryButton full onClick={handleSubmit}>
            문의 보내기
          </PrimaryButton>
        </div>

        {/* 내 문의 내역 */}
        <p className="text-sm font-semibold text-gray-700">내 문의 내역</p>
        {inquiries.length === 0 ? (
          <Empty text="아직 문의 내역이 없어요." />
        ) : (
          <div className="space-y-2">
            {inquiries.map((q) => (
              <div key={q.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{q.title}</p>
                    <p className="text-xs text-gray-400">{q.createdAt}</p>
                  </div>
                  <button onClick={() => deleteInquiry(q.id)} className="text-gray-300" aria-label="문의 삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
                {q.body && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{q.body}</p>}
                {q.images && q.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.images.map((src, i) => (
                      <img key={i} src={src} alt={`첨부 ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                {q.answer ? (
                  <div className="mt-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                    <b>답변</b> · {q.answer}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">답변 대기 중</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 관리자 이메일 안내 (가장 하단) */}
        <p className="pt-2 text-center text-xs text-gray-400">
          빠른 문의는 관리자 이메일로 연락해 주세요
          <br />
          <a href="mailto:jeongha237@dankook.ac.kr" className="text-orange-500">
            jeongha237@dankook.ac.kr
          </a>
        </p>
      </div>
    </Page>
  );
}

// ----- (관리자) 문의 확인 + 답변 -----
export function AdminInquiries() {
  const {inquiries, answerInquiry, deleteInquiry} = useStore();
  const nav = useNav();

  function handleAnswer(id: number, current?: string) {
    const answer = window.prompt('답변을 입력하세요.', current ?? '');
    if (answer && answer.trim()) answerInquiry(id, answer.trim());
  }

  return (
    <Page title="문의 확인" onBack={nav.pop}>
      {inquiries.length === 0 ? (
        <Empty text="들어온 문의가 없어요." />
      ) : (
        <div className="space-y-2 p-4">
          {inquiries.map((q) => (
            <div key={q.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {q.title}
                    {!q.answer && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-500">미답변</span>}
                  </p>
                  <p className="text-xs text-gray-400">{q.createdAt}</p>
                </div>
                <button onClick={() => deleteInquiry(q.id)} className="text-gray-300" aria-label="문의 삭제">
                  <Trash2 size={16} />
                </button>
              </div>
              {q.body && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{q.body}</p>}
              {q.images && q.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.images.map((src, i) => (
                    <img key={i} src={src} alt={`첨부 ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                  ))}
                </div>
              )}
              {q.answer && (
                <div className="mt-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                  <b>답변</b> · {q.answer}
                </div>
              )}
              <button onClick={() => handleAnswer(q.id, q.answer)} className="mt-2 text-sm font-medium text-orange-500">
                {q.answer ? '답변 수정' : '답변하기'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

// ----- (관리자) 졸업 인증 요청 심사 -----
export function AdminVerifications() {
  const {verifications, approveVerification, rejectVerification} = useStore();
  const nav = useNav();
  const list = verifications ?? [];
  // 대기 중을 위로
  const sorted = [...list].sort((a, b) => (a.status === '대기' ? -1 : 1) - (b.status === '대기' ? -1 : 1));

  return (
    <Page title="인증 요청" onBack={nav.pop}>
      {sorted.length === 0 ? (
        <Empty text="인증 요청이 없어요." />
      ) : (
        <div className="space-y-2 p-4">
          {sorted.map((v) => (
            <div key={v.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{v.userName}</span>
                {/* 인증 종류 배지 (대학🎓 / 지역📍) + 제출 수단 */}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    v.type === '지역' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {v.type === '지역' ? '📍 지역' : '🎓 대학'}
                </span>
                <span className="text-xs text-gray-500">{v.method}</span>
                <span className="text-xs text-gray-400">
                  {v.school}
                  {v.gradYear && ` ${v.gradYear}년`}
                </span>
                <span
                  className={`ml-auto text-xs ${
                    v.status === '대기' ? 'text-yellow-600' : v.status === '승인' ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {v.status}
                </span>
              </div>
              {/* 심사 참고 정보 — 제출 서류의 이름/생년월일/졸업연도와 대조해 승인 판단 */}
              {(v.realName || v.birth || (v.type === '대학' && v.gradYear)) && (
                <div className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800">
                  {/* 본인인증 실명 (+지역 인증이면 생년월일) */}
                  {v.realName && (
                    <p>
                      🪪 실명: <b>{v.realName}</b>
                      {v.type === '지역' && v.birth && <span> · 생년월일 {v.birth}</span>}
                    </p>
                  )}
                  {/* 대학 인증이면 학교 + 졸업연도 (졸업증명서 대조용) */}
                  {v.type === '대학' && (
                    <p className={v.realName ? 'mt-0.5' : ''}>
                      🎓 {v.school}
                      {v.gradYear && (
                        <span>
                          {' '}· 졸업 <b>{v.gradYear}년</b>
                        </span>
                      )}
                    </p>
                  )}
                  <p className="mt-0.5 text-blue-500">
                    {v.type === '지역'
                      ? '↳ 주민등록증의 실명·생년월일과 같은지 확인하세요.'
                      : `↳ 제출 서류(${v.method})의 이름·졸업연도와 같은지 확인하세요.`}
                  </p>
                </div>
              )}
              {/* 제출한 인증 서류 */}
              <img src={v.cert} alt="인증 서류" className="mt-2 max-h-60 w-full rounded-lg border border-gray-100 object-contain" />
              <p className="mt-1 text-xs text-gray-400">제출일 {v.createdAt}</p>
              {/* 거절된 요청이면 사유 표시 */}
              {v.status === '거절' && v.rejectReason && (
                <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs text-red-600">거절 사유: {v.rejectReason}</p>
              )}
              {v.status === '대기' && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      const reason = window.prompt('거절 사유를 입력해 주세요. (신청자에게 보여집니다)');
                      if (reason === null) return; // 취소
                      rejectVerification(v.id, reason.trim() || undefined);
                    }}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => {
                      approveVerification(v.id);
                      window.alert(`${v.userName} 님을 인증 승인했어요.`);
                    }}
                    className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white"
                  >
                    승인
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

// ----- (관리자) 신고 확인 -----
export function AdminReports() {
  const {reports} = useStore();
  const nav = useNav();
  const list = reports ?? [];
  const [processing, setProcessing] = useState<Report | null>(null); // 처리 모달에 띄울 신고

  // 신고 대상 글로 바로 이동 (게시글/댓글이면 글 상세로)
  function openTarget(r: Report) {
    if (r.targetId == null) return;
    if (r.targetType === '게시글' || r.targetType === '댓글') nav.push({name: 'postDetail', id: r.targetId});
    else if (r.targetType === '채팅방') nav.push({name: 'chatRoom', id: r.targetId});
    else if (r.targetType === '모임') nav.push({name: 'meetupDetail', id: r.targetId});
    else if (r.targetType === '상품') nav.push({name: 'marketDetail', id: r.targetId});
  }

  return (
    <Page title="신고 확인" onBack={nav.pop}>
      {list.length === 0 ? (
        <Empty text="들어온 신고가 없어요." />
      ) : (
        <div className="space-y-2 p-4">
          {list.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{r.targetType}</span>
                {/* 제목을 누르면 대상 글로 바로 이동 */}
                <button onClick={() => openTarget(r)} className="min-w-0 flex-1 truncate text-left font-medium text-orange-600 underline">
                  {r.targetLabel}
                </button>
                {r.handled ? (
                  <span className="text-xs text-green-600">처리완료</span>
                ) : (
                  <span className="text-xs text-red-500">미처리</span>
                )}
              </div>
              {r.targetUser && <p className="mt-1 text-xs text-gray-500">대상자: {r.targetUser}</p>}
              <p className="mt-1 text-sm text-gray-600">사유: {r.reason}</p>
              {/* 신고에 첨부된 증거 사진 */}
              {r.image && <img src={r.image} alt="신고 증거" className="mt-2 max-h-48 rounded-lg object-cover" />}
              <p className="mt-0.5 text-xs text-gray-400">
                신고자: {r.reporterName} · {r.createdAt}
              </p>
              {!r.handled && (
                <button onClick={() => setProcessing(r)} className="mt-2 text-sm font-medium text-orange-500">
                  처리하기
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 처리 모달 */}
      {processing && <ProcessReportModal report={processing} onClose={() => setProcessing(null)} />}
    </Page>
  );
}

// ----- (관리자) 신고 처리 모달: 대상 정보 + 정지 / 문제 없음 -----
function ProcessReportModal({report, onClose}: {report: Report; onClose: () => void}) {
  const {users, updateUser, markReportHandled} = useStore();
  const [period, setPeriod] = useState<SuspendPeriod>('1달');
  // 대상자(닉네임)로 회원 계정을 찾습니다. (익명이면 못 찾음)
  const target = report.targetUser ? users.find((u) => u.nickname === report.targetUser) : undefined;

  function handleSuspend() {
    if (!target) {
      window.alert('대상 회원을 찾을 수 없어요. (익명이거나 탈퇴한 회원)');
      return;
    }
    updateUser(target.id, {
      status: '정지',
      suspendReason: report.reason,
      suspendPeriod: period,
      suspendUntil: untilDate(period),
    });
    markReportHandled(report.id);
    window.alert(`${target.nickname} 님을 ${period} 정지 처리했어요.`);
    onClose();
  }

  function handleNoProblem() {
    markReportHandled(report.id); // 문제 없음도 '처리됨'으로 기록
    onClose();
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-base font-bold text-gray-900">신고 처리</p>

        {/* 신고 대상 정보 */}
        <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <p className="text-gray-700">
            <b>{report.targetType}</b> · {report.targetLabel}
          </p>
          <p className="text-gray-500">대상자: {report.targetUser ?? '알 수 없음(익명)'}</p>
          <p className="text-gray-500">사유: {report.reason}</p>
          <p className="text-gray-400">신고자: {report.reporterName}</p>
        </div>

        {/* 정지 기간 선택 (대상 회원을 찾을 수 있을 때만) */}
        {target ? (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium text-gray-700">정지 기간</p>
            <select className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value as SuspendPeriod)}>
              {SUSPEND_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">해제 예정일: {untilDate(period)}</p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            ※ 익명 또는 탈퇴한 회원이라 정지할 수 없어요. ‘문제 없음’으로 처리만 할 수 있습니다.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={handleNoProblem} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
            문제 없음
          </button>
          <button
            onClick={handleSuspend}
            disabled={!target}
            className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {target ? `${report.targetUser} 정지` : '정지 불가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- 쪽지함 (대화 상대 목록) -----
export function NotesScreen() {
  const {notes, me} = useStore();
  const nav = useNav();
  // 지금 로그인한 사람이 주고받은 쪽지만 (최신순)
  const list = (notes ?? []).filter((n) => n.fromName === me.nickname || n.toName === me.nickname);

  // 상대방별로 묶어서 "대화 목록"을 만듭니다. (익명은 '익명' 하나로 묶음)
  const seen = new Set<string>();
  const convos: {name: string; last: (typeof list)[number]; unread: number}[] = [];
  for (const n of list) {
    const isMine = n.fromName === me.nickname; // 내가 보낸 쪽지인지 (로그인 기준)
    const other = isMine ? n.toName : n.fromName; // 대화 상대
    if (!seen.has(other)) {
      seen.add(other);
      convos.push({name: other, last: n, unread: 0});
    }
  }
  // 안 읽은 쪽지 수 세기 (내가 받은 것만)
  for (const n of list) {
    if (n.toName === me.nickname && !n.read) {
      const c = convos.find((x) => x.name === n.fromName);
      if (c) c.unread += 1;
    }
  }

  return (
    <Page title="쪽지함" onBack={nav.pop}>
      {convos.length === 0 ? (
        <Empty text="아직 주고받은 쪽지가 없어요." />
      ) : (
        <div className="overflow-hidden">
          {convos.map((c) => (
            <button
              key={c.name}
              onClick={() => nav.push({name: 'noteThread', with: c.name})}
              className="flex w-full items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 text-left active:bg-gray-50"
            >
              <Avatar size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-orange-500 px-1.5 text-xs text-white">{c.unread}</span>
                  )}
                </div>
                <p className="truncate text-sm text-gray-500">{c.last.body}</p>
              </div>
              <span className="flex-none text-xs text-gray-400">{c.last.createdAt}</span>
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}

// ----- 쪽지 대화 (특정 상대) / 익명이면 익명 쪽지 목록 -----
export function NoteThread({with: withName}: {with: string}) {
  const {notes, me, sendNote, deleteNote, markNoteRead} = useStore();
  const nav = useNav();
  const [text, setText] = useState('');
  const isAnon = withName === '익명';

  // 지금 로그인한 사람과 withName 사이에 오간 쪽지들 (최신순)
  const thread = (notes ?? []).filter((n) => {
    const involvesMe = n.fromName === me.nickname || n.toName === me.nickname;
    const other = n.fromName === me.nickname ? n.toName : n.fromName;
    return involvesMe && other === withName;
  });

  // 내가 받은 안 읽은 쪽지는 들어오면 읽음 처리
  useEffect(() => {
    thread.forEach((n) => {
      if (n.toName === me.nickname && !n.read) markNoteRead(n.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSend() {
    if (!text.trim()) return;
    sendNote(withName, text.trim());
    setText('');
  }

  // 익명: 대화로 묶을 수 없으니 쪽지들을 최신순 목록으로만 보여줍니다.
  if (isAnon) {
    return (
      <Page title="익명 쪽지" onBack={nav.pop}>
        {thread.length === 0 ? (
          <Empty text="익명 쪽지가 없어요." />
        ) : (
          <div className="space-y-2 p-4">
            {thread.map((n) => (
              <div key={n.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-400">
                    {n.fromName === me.nickname ? '보낸 쪽지' : '받은 쪽지'} · {n.createdAt}
                  </p>
                  <button onClick={() => deleteNote(n.id)} className="text-gray-300" aria-label="쪽지 삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </Page>
    );
  }

  // 일반 상대: 카톡처럼 대화로 보여주고 답장도 가능
  const ordered = [...thread].reverse(); // 오래된 → 최신 순
  return (
    <Page
      title={withName}
      onBack={nav.pop}
      footer={
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="쪽지를 입력하세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <PrimaryButton onClick={handleSend}>전송</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-2 p-4">
        {ordered.map((n) => {
          const mine = n.fromName === me.nickname; // 로그인 기준 보낸사람 판정
          return (
          <div key={n.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                mine ? 'bg-orange-500 text-white' : 'bg-white text-gray-800 shadow-sm'
              }`}
            >
              {n.body}
              <div className={`mt-0.5 text-[10px] ${mine ? 'text-orange-100' : 'text-gray-400'}`}>{n.createdAt}</div>
            </div>
          </div>
          );
        })}
      </div>
    </Page>
  );
}

// ----- 쪽지 보내기 -----
export function NoteSend({to}: {to: string}) {
  const {sendNote} = useStore();
  const nav = useNav();
  const [body, setBody] = useState('');

  function handleSend() {
    if (!body.trim()) {
      window.alert('쪽지 내용을 입력해 주세요.');
      return;
    }
    sendNote(to, body.trim());
    window.alert('쪽지를 보냈어요.');
    nav.pop();
  }

  return (
    <Page
      title="쪽지 보내기"
      onBack={nav.pop}
      footer={
        <PrimaryButton full onClick={handleSend}>
          보내기
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="받는 사람">
          <input className={inputClass} value={to} disabled />
        </Field>
        <Field label="내용">
          <textarea
            className={`${inputClass} h-32 resize-none`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="쪽지 내용을 입력하세요"
          />
        </Field>
      </div>
    </Page>
  );
}
