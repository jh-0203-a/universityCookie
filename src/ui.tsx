// ============================================================
// 여러 화면에서 공통으로 쓰는 작은 UI 부품들입니다.
// (헤더, 페이지 틀, 입력칸, 버튼 등)
// ============================================================
import {useRef, useState, type ChangeEvent, type ReactNode} from 'react';
import {ArrowLeft, Bell, ImagePlus, Plus, User} from 'lucide-react';
import {REGION_TREE} from './regions';
import {UNIVERSITIES} from './universities';
import {REPORT_REASONS} from './types';
import {useStore} from './data';
import logoUrl from '../logo.png'; // 프로젝트 최상위의 로고 이미지

// 상단 헤더. onBack 이 있으면 왼쪽에 뒤로가기 화살표가 생깁니다.
// onLogoClick 이 있으면 (뒤로가기가 없을 때) 왼쪽에 로고가 뜨고, 누르면 홈으로 갑니다.
// right 를 넘기면 오른쪽에 버튼 등을 넣을 수 있어요 (예: 채팅방 메뉴).
export function Header({
  title,
  onBack,
  right,
  onLogoClick,
  onBell,
  bellCount = 0,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  onLogoClick?: () => void;
  onBell?: () => void; // 알림 종 버튼 (메인 탭 헤더에서 사용)
  bellCount?: number; // 안 읽은 알림 수
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-white px-3 py-3 shadow-sm">
      {onBack ? (
        <button onClick={onBack} className="text-gray-600" aria-label="뒤로가기">
          <ArrowLeft size={22} />
        </button>
      ) : (
        onLogoClick && (
          <button onClick={onLogoClick} aria-label="홈으로">
            <img src={logoUrl} alt="청년와글 로고" className="h-8 w-8 rounded-full object-cover" />
          </button>
        )
      )}
      <h1 className="flex-1 truncate text-lg font-bold text-orange-500">{title}</h1>
      {right ? (
        <div className="flex items-center gap-3 text-gray-500">{right}</div>
      ) : (
        !onBack && (
          <div className="flex items-center gap-3 text-gray-500">
            {onBell ? (
              <button onClick={onBell} aria-label="알림" className="relative text-gray-500">
                <Bell size={20} />
                {bellCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] text-white">
                    {bellCount}
                  </span>
                )}
              </button>
            ) : (
              <Bell size={20} />
            )}
          </div>
        )
      )}
    </header>
  );
}

// 세부 화면(상세/폼)에서 쓰는 페이지 틀. 헤더 + 스크롤 영역 + (선택)하단 고정 버튼.
export function Page({
  title,
  onBack,
  children,
  footer,
  headerRight,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode; // 헤더 오른쪽에 넣을 버튼 (예: 채팅방 메뉴)
}) {
  return (
    <div className="flex h-full flex-col">
      <Header title={title} onBack={onBack} right={headerRight} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      {footer && <div className="border-t border-gray-200 bg-white p-3">{footer}</div>}
    </div>
  );
}

// 프로필 사진 동그라미. src(이미지 주소)가 있으면 사진을, 없으면 기본 사람 아이콘을 보여줍니다.
export function Avatar({src, size = 40}: {src?: string; size?: number}) {
  if (src) {
    return (
      <img
        src={src}
        alt="프로필 사진"
        className="flex-none rounded-full object-cover"
        style={{width: size, height: size}}
      />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-orange-100 text-orange-500"
      style={{width: size, height: size}}
    >
      <User size={Math.round(size * 0.55)} />
    </div>
  );
}

// 입력칸 공통 스타일 (input/select/textarea 에 그대로 붙여 씁니다)
export const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none';

// 학교 지역(시/도 → 권역)은 단계별 드롭다운, 학교는 전국 대학 검색(아무 대학이나 선택 가능).
// 저장값은 region(학교 권역)과 school(학교 이름) 두 개.
export function RegionSchoolPicker({
  region,
  school,
  onChange,
  lockRegion,
  onReverify,
  regionCity,
  regionVerified,
}: {
  region: string;
  school: string;
  onChange: (region: string, school: string) => void;
  lockRegion?: boolean; // true 면 거주 지역을 고정(읽기 전용)으로 보여줍니다. (변경은 지역 재인증으로만)
  onReverify?: () => void; // "지역 재인증하기"/"지역 인증하기" 버튼을 눌렀을 때 (보통 인증 화면으로 이동)
  regionCity?: string; // 지역 인증으로 확인된 정확한 위치(예: '경기도 수원시'). 있으면 잠긴 표시에 우선 노출
  regionVerified?: boolean; // 지역 인증(📍) 여부. 안 됐으면 거주 지역을 공백으로 두고 "지역 인증하기" 링크를 보여줍니다.
}) {
  // 현재 region 이 어느 시/도에 속하는지 찾아 초기 시/도를 정합니다.
  const [sido, setSido] = useState(
    () => REGION_TREE.find((s) => s.areas.some((a) => a.region === region))?.sido ?? '',
  );
  const sidoNode = REGION_TREE.find((s) => s.sido === sido);

  return (
    <div className="space-y-3">
      {/* 서비스 지역 안내: 현재 수도권만 오픈, 지방은 차츰 확대 예정 */}
      <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
        현재는 <b>서울·경기·인천</b>의 대학교만 서비스하고 있어요. 지방 지역은 차츰 열어갈 예정입니다.
      </p>
      {lockRegion ? (
        // 거주 지역은 지역 인증으로 확인되는 정보라 여기서 직접 못 바꿉니다.
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">거주 지역</span>
          {regionVerified ? (
            // 지역 인증 완료: 인증으로 확인된 거주지를 읽기 전용으로 보여줍니다.
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {regionCity || region || '미설정'}
                {/* 권역과 정확한 위치를 함께 갖고 있으면 둘 다 보여줍니다. */}
                {regionCity && region && <span className="ml-1 text-xs text-gray-400">({region})</span>}
              </div>
              <p className="mt-1 text-xs text-gray-500">📍 지역은 인증으로 확인되는 정보예요. 변경하려면 지역 재인증이 필요합니다.</p>
              {onReverify && (
                <button onClick={onReverify} className="mt-1.5 text-xs font-medium text-orange-500 underline">
                  지역 재인증하기
                </button>
              )}
            </>
          ) : (
            // 지역 인증 안 됨: 거주 지역은 공백으로 두고 "지역 인증하기" 링크를 안내합니다.
            <>
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                지역 인증 전이에요
              </div>
              <p className="mt-1 text-xs text-gray-500">📍 지역 인증을 하면 거주 지역이 표시되고 지역별 게시판도 이용할 수 있어요.</p>
              {onReverify && (
                <button onClick={onReverify} className="mt-1.5 text-xs font-medium text-orange-500 underline">
                  지역 인증하기
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <Field label="학교 시/도">
            <select
              className={inputClass}
              value={sido}
              onChange={(e) => {
                setSido(e.target.value);
                onChange('', school); // 시/도 바뀌면 권역만 초기화 (학교는 유지)
              }}
            >
              <option value="">선택하세요</option>
              {REGION_TREE.map((s) => (
                <option key={s.sido} value={s.sido}>
                  {s.sido}
                </option>
              ))}
            </select>
          </Field>
          <Field label="학교 권역">
            <select
              className={inputClass}
              value={region}
              disabled={!sidoNode}
              onChange={(e) => onChange(e.target.value, school)}
            >
              <option value="">선택하세요</option>
              {sidoNode?.areas.map((a) => (
                <option key={a.region} value={a.region}>
                  {a.region}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      <Field label="졸업 학교">
        {/* 전국 대학 검색/선택 (입력하면 자동완성) */}
        <input
          className={inputClass}
          list="university-list"
          value={school}
          onChange={(e) => onChange(region, e.target.value)}
          placeholder="학교 이름 검색 (예: 아주대학교)"
        />
        <datalist id="university-list">
          {UNIVERSITIES.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}

// 대학 인증 배지입니다. "어떤 수단으로 인증했는지"에 따라 라벨/색이 달라집니다.
//  - 증명서(재학/졸업) → 🎓 증명서 (가장 확실 · 주황)
//  - 대학교 이메일      → 🎓 학교이메일 (파랑)
//  - 그 외 보조 수단     → 🎓 대학 (기본 · 호박색)
export function SchoolBadge({method, school}: {method?: string; school?: string}) {
  const b = method?.includes('증명서')
    ? {short: '증명서', title: '증명서 인증', cls: 'bg-orange-100 text-orange-700'}
    : method?.includes('이메일')
      ? {short: '학교이메일', title: '대학교 이메일 인증', cls: 'bg-blue-100 text-blue-700'}
      : {short: '대학', title: '대학 인증', cls: 'bg-amber-100 text-amber-700'};
  // 학교명이 있으면 "🎓 수원대학교 · 증명서", 없으면 "🎓 증명서"
  const text = school ? `🎓 ${school} · ${b.short}` : `🎓 ${b.short}`;
  return (
    <span
      title={school ? `${b.title} · ${school}` : b.title}
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${b.cls}`}
    >
      {text}
    </span>
  );
}

// 사진을 전체 화면으로 크게 보는 부품(라이트박스).
//  - src 가 있으면 어두운 배경 위에 사진을 잘리지 않게(object-contain) 꽉 차게 보여줍니다.
//  - 배경/사진/✕ 아무 곳이나 누르면 닫힙니다.
export function ImageLightbox({src, onClose}: {src?: string; onClose: () => void}) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label="사진 확대"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <img src={src} alt="확대한 사진" className="max-h-full max-w-full object-contain" />
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xl leading-none text-white"
      >
        ×
      </button>
    </div>
  );
}

// 지역 인증 배지 (초록). city 가 있으면 '📍 수원'처럼, 없으면(또는 숨김) '📍 지역'.
export function RegionBadge({city}: {city?: string}) {
  return (
    <span
      title={city ? `지역 인증 · ${city}` : '지역 인증'}
      className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-green-700"
    >
      📍 {city || '지역'}
    </span>
  );
}

// 닉네임 옆에 붙는 "인증 배지" 묶음입니다.
//  - 인증한 회원만 표시되고, 안 했으면 아무것도 안 나와요.
//  - 익명 글에는 굳이 배지를 달지 않으려고 nickname 이 '익명'이면 표시하지 않습니다.
//  - 쓰는 법: 닉네임 텍스트 바로 뒤에 <VerifiedBadges nickname={author} /> 만 넣으면 됩니다.
export function VerifiedBadges({nickname}: {nickname: string}) {
  const {badgesOf} = useStore();
  if (!nickname || nickname === '익명') return null;
  const {school, region, schoolMethod, schoolName, regionName, hideSchool, hideRegion} = badgesOf(nickname);
  if (!school && !region) return null;
  return (
    <span className="ml-1 inline-flex items-center gap-1 align-middle">
      {/* 설정에서 "대학교명 숨기기/지역명 숨기기"를 켜면 이름 없이 배지만 보여줍니다. */}
      {school && <SchoolBadge method={schoolMethod} school={hideSchool ? undefined : schoolName} />}
      {region && <RegionBadge city={hideRegion ? undefined : regionName} />}
    </span>
  );
}

// 라벨 + 입력칸을 묶어주는 부품
export function Field({label, children}: {label: string; children: ReactNode}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

// 주황색 메인 버튼
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  full,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  full?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 ${
        full ? 'w-full' : ''
      }`}
    >
      {children}
    </button>
  );
}

// 회색 보조 버튼 (수정 등)
export function GhostButton({children, onClick, full}: {children: ReactNode; onClick?: () => void; full?: boolean}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

// 빨간 삭제 버튼
export function DangerButton({children, onClick}: {children: ReactNode; onClick?: () => void}) {
  return (
    <button onClick={onClick} className="rounded-lg px-4 py-2.5 text-sm font-medium text-red-500">
      {children}
    </button>
  );
}

// 오른쪽 아래에 떠 있는 동그란 + 버튼 (글쓰기/등록)
export function Fab({onClick}: {onClick: () => void}) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 right-4 z-10 rounded-full bg-orange-500 p-4 text-white shadow-lg"
      aria-label="새로 만들기"
    >
      <Plus size={22} />
    </button>
  );
}

// 목록이 비었을 때 보여주는 안내 문구
export function Empty({text}: {text: string}) {
  return <p className="px-4 py-16 text-center text-sm text-gray-400">{text}</p>;
}

// 신고 모달. 사유를 목록에서 고르고, '기타'를 고르면 직접 입력합니다.
// 신고하기를 누르면 고른 사유를 onSubmit 으로 넘깁니다.
export function ReportModal({
  who,
  onClose,
  onSubmit,
}: {
  who?: string; // 누구를 신고하는지 (작성자 닉네임)
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [selected, setSelected] = useState<string>(REPORT_REASONS[0]);
  const [etc, setEtc] = useState('');

  function handleSubmit() {
    const reason = selected === '기타' ? etc.trim() : selected;
    if (!reason) {
      window.alert('신고 사유를 입력해 주세요.');
      return;
    }
    onSubmit(reason);
    onClose();
  }

  return (
    // 아래에서 올라오는 시트 형태
    <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 text-base font-bold text-gray-900">신고하기</p>
        {who && <p className="mb-3 text-sm text-gray-500">대상: {who}</p>}

        <div className="space-y-1">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 py-2 text-sm text-gray-800">
              <input type="radio" name="report-reason" checked={selected === r} onChange={() => setSelected(r)} />
              {r}
            </label>
          ))}
        </div>

        {/* '기타'일 때만 직접 입력 */}
        {selected === '기타' && (
          <input
            className={`${inputClass} mt-1`}
            value={etc}
            onChange={(e) => setEtc(e.target.value)}
            placeholder="신고 사유를 입력하세요"
          />
        )}

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

// 고른 사진 파일을 "정해진 크기 이하로 줄여서" 글자(data URL)로 바꿔줍니다.
// 사진을 줄이지 않으면 용량이 커서 localStorage 에 저장하다 앱이 멈출 수 있어요.
export function fileToScaledDataUrl(file: File, maxSize = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let {width, height} = img;
        // 가로/세로 중 긴 쪽을 maxSize 에 맞춰 비율 유지하며 줄입니다.
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string); // 혹시 캔버스를 못 쓰면 원본 그대로
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality)); // jpeg 로 압축
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// 사진 여러 장 첨부 부품 (최대 max 장). 게시판/문의에서 사용합니다.
export function MultiImagePicker({
  values,
  onChange,
  max = 5,
  label = '사진',
}: {
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  async function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    const room = max - values.length; // 더 넣을 수 있는 칸 수
    const picked = await Promise.all(files.slice(0, room).map((f) => fileToScaledDataUrl(f)));
    onChange([...values, ...picked]);
    e.target.value = ''; // 같은 사진을 또 고를 수 있게 초기화
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label} ({values.length}/{max})
      </span>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={handlePick} />
      <div className="flex flex-wrap gap-2">
        {values.map((src, i) => (
          <div key={i} className="relative">
            <img src={src} alt={`사진 ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
            <button
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white"
              aria-label="사진 삭제"
            >
              ×
            </button>
          </div>
        ))}
        {values.length < max && (
          <button
            onClick={() => ref.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400"
          >
            <ImagePlus size={22} />
            <span className="mt-0.5 text-[10px]">추가</span>
          </button>
        )}
      </div>
    </div>
  );
}

// 사진 첨부 부품(1장). value(이미지 주소)가 있으면 미리보기를, 없으면 "사진 추가" 칸을 보여줍니다.
// 고른 사진은 자동으로 크기를 줄여 onChange 로 전달합니다.
export function ImagePicker({
  value,
  onChange,
  label = '사진',
}: {
  value?: string;
  onChange: (v?: string) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  async function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(await fileToScaledDataUrl(file));
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handlePick} />
      {value ? (
        <div>
          <img src={value} alt="첨부 사진" className="h-40 w-40 rounded-lg object-cover" />
          <div className="mt-2 flex gap-3 text-sm">
            <button onClick={() => ref.current?.click()} className="font-medium text-orange-500">
              사진 변경
            </button>
            <button onClick={() => onChange(undefined)} className="text-gray-400">
              사진 삭제
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="flex h-40 w-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400"
        >
          <ImagePlus size={28} />
          <span className="mt-1 text-xs">사진 추가</span>
        </button>
      )}
    </div>
  );
}
