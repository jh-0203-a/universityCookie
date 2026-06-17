// ============================================================
// 로그인 / 회원가입 화면입니다.
//  - 로그아웃 상태(session 이 null)일 때 앱 대신 이 화면이 보입니다.
//  - "졸업생 동문 커뮤니티" 라는 정체성을 문구로 강조합니다.
//  - 재학증명서 같은 인증은 받지 않습니다. (졸업생이면 누구나 가입)
//  - 지금은 목업이라 비밀번호는 확인하지 않습니다.
// ============================================================
import {useState} from 'react';
import {GraduationCap} from 'lucide-react';
import logoUrl from '../logo.png';
import {useStore} from './data';
import {Field, PrimaryButton, RegionSchoolPicker, inputClass} from './ui';

export function LoginScreen() {
  const {login, signup, sendOtp, verifyOtp} = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState(0); // 회원가입 단계 (0:계정 1:본인확인 2:학교·지역)
  const [error, setError] = useState<string | null>(null);

  // 입력값들 (회원가입 때 더 많이 사용)
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [school, setSchool] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [region, setRegion] = useState('');
  const [realName, setRealName] = useState(''); // 실명 (휴대폰 본인인증으로 확인)
  const [birth, setBirth] = useState(''); // 생년월일 (예: 1999-03-15)
  const [address, setAddress] = useState(''); // 실거주지 주소 (○○동까지, 지역 인증 때 주민등록증과 대조)

  // 휴대폰 본인인증 상태
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false); // 인증번호를 보냈는지
  const [otpCode, setOtpCode] = useState(''); // 입력한 인증번호
  const [phoneVerified, setPhoneVerified] = useState(false); // 본인인증 완료 여부
  const [devCode, setDevCode] = useState<string | null>(null); // 개발용으로 표시할 인증번호

  const [busy, setBusy] = useState(false); // 서버 응답 기다리는 중

  async function handleLogin() {
    if (!email.trim()) return setError('이메일을 입력해 주세요.');
    setBusy(true);
    setError(await login(email, password)); // 실패하면 메시지, 성공하면 null
    setBusy(false);
  }

  async function handleSignup() {
    if (!nickname.trim()) return setError('닉네임을 입력해 주세요.');
    if (!email.trim()) return setError('이메일을 입력해 주세요.');
    if (!realName.trim()) return setError('실명을 입력해 주세요.');
    if (!birth.trim()) return setError('생년월일을 입력해 주세요.');
    if (!phoneVerified) return setError('휴대폰 본인인증을 완료해 주세요.');
    if (!region) return setError('학교 권역(시/도·권역)을 선택해 주세요.');
    if (!school) return setError('학교를 선택해 주세요.');
    if (!address.trim()) return setError('실거주지 주소를 입력해 주세요. (동까지)');
    setBusy(true);
    setError(await signup({nickname, email, password, school, gradYear, region, phone, realName, birth, address}));
    setBusy(false);
  }

  // 인증번호 보내기 — 본인인증은 실명·생년월일·휴대폰번호를 함께 확인하는 절차예요.
  async function handleSendOtp() {
    if (!realName.trim()) return setError('실명을 입력해 주세요.');
    if (!birth.trim()) return setError('생년월일을 입력해 주세요.');
    if (!phone.trim()) return setError('휴대폰 번호를 입력해 주세요.');
    setError(null);
    const r = await sendOtp(phone);
    if (!r.ok) return setError(r.error ?? '인증번호 전송에 실패했어요.');
    setOtpSent(true);
    setDevCode(r.devCode ?? null);
  }

  // 인증번호 확인 — 실명·생년월일도 함께 보내 본인인증으로 확정합니다.
  async function handleVerifyOtp() {
    const msg = await verifyOtp(phone, otpCode, realName, birth);
    if (msg) return setError(msg);
    setPhoneVerified(true);
    setError(null);
  }

  // 다음 단계로 (현재 단계 입력만 검사하고 넘어감)
  function next() {
    setError(null);
    if (step === 0) {
      if (!nickname.trim()) return setError('닉네임을 입력해 주세요.');
      if (!email.trim()) return setError('이메일을 입력해 주세요.');
      if (!password.trim()) return setError('비밀번호를 입력해 주세요.');
    }
    if (step === 1) {
      if (!realName.trim()) return setError('실명을 입력해 주세요.');
      if (!birth.trim()) return setError('생년월일을 입력해 주세요.');
      if (!phoneVerified) return setError('휴대폰 본인인증을 완료해 주세요.');
    }
    setStep(step + 1);
  }

  // 휴대폰 번호를 고치면 인증을 처음부터 다시
  function changePhone(v: string) {
    setPhone(v);
    setPhoneVerified(false);
    setOtpSent(false);
    setOtpCode('');
    setDevCode(null);
  }

  // 실명/생년월일을 고치면 본인인증을 처음부터 다시 (인증한 정보와 일치해야 하므로)
  function resetIdentity() {
    setPhoneVerified(false);
    setOtpSent(false);
    setOtpCode('');
    setDevCode(null);
  }

  return (
    <div className="flex h-full">
      {/* 데스크톱 전용 좌측 브랜드 패널 (모바일에선 숨김 → 앱 화면 보존) */}
      <div className="hidden flex-col items-center justify-center bg-orange-500 p-10 text-center text-white md:flex md:w-1/2">
        <img src={logoUrl} alt="청년와글" className="mb-4 h-20 w-20 rounded-2xl object-cover" />
        <h1 className="text-3xl font-bold">청년와글</h1>
        <p className="mt-3 text-orange-50">20·30 청년들의 동네 생활 플랫폼</p>
        <p className="mt-1 text-sm text-orange-100">모임 · 스터디 · 중고거래 · 커뮤니티</p>
      </div>

      {/* 폼 패널 (모바일=가운데 카드 그대로, 데스크톱=오른쪽 절반)
          ※ justify-center 대신 카드에 my-auto 를 줘야, 내용이 길어도 위가 잘리지 않고 스크롤됩니다. */}
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto bg-gray-100 p-6 md:w-1/2 md:max-w-none md:bg-white">
        <div className="my-auto w-full rounded-2xl bg-white p-6 shadow-sm md:mx-auto md:max-w-md md:shadow-none">
          {/* 브랜드 헤더 — 모바일에서만 (데스크톱은 좌측 패널이 대신) */}
          <div className="mb-6 text-center md:hidden">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-500">
            <GraduationCap size={26} />
          </div>
          <h1 className="text-2xl font-bold text-orange-500">청년와글</h1>
          <p className="mt-1 text-sm font-medium text-gray-700">20·30 청년들의 동네 생활 플랫폼</p>
          <p className="mt-0.5 text-xs text-gray-400">모임·스터디·중고거래·커뮤니티 · 대학🎓/지역📍 인증 배지</p>
        </div>

        {/* 테스트(베타) 단계 안내 */}
        <div className="mb-4 rounded-xl bg-yellow-50 px-3 py-2 text-center text-xs text-yellow-800">
          🚧 현재 <b>테스트 단계</b>예요. 일부 기능이 바뀌거나 데이터가 초기화될 수 있어요.
        </div>

        <div className="space-y-3">
          {/* 회원가입 단계 표시기 (3단계) */}
          {mode === 'signup' && (
            <div className="mb-1">
              <div className="flex gap-1.5">
                {['계정', '본인 확인', '학교·지역'].map((t, i) => (
                  <div key={t} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-orange-500' : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className="mt-1.5 text-xs font-medium text-gray-500">
                {step + 1}/3 단계 · {['계정', '본인 확인', '학교·지역'][step]}
              </p>
            </div>
          )}

          {/* 1단계(계정): 닉네임·이메일·비밀번호 / 로그인은 이메일·비밀번호만 */}
          {(mode === 'login' || step === 0) && (
            <>
              {mode === 'signup' && (
                <Field label="닉네임">
                  <input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="동네 이웃들에게 보일 이름" />
                </Field>
              )}

              <Field label="이메일">
                <input
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? handleLogin() : next())}
                  placeholder="이메일 (gmail 등 무엇이든 OK)"
                />
              </Field>

              <Field label="비밀번호">
                <input
                  className={inputClass}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? handleLogin() : next())}
                  placeholder="비밀번호"
                />
              </Field>
            </>
          )}

          {/* 2단계(본인 확인): 실명·생년월일·휴대폰 인증 */}
          {mode === 'signup' && step === 1 && (
            <>
              {/* 본인 확인: 실명 + 생년월일 + 휴대폰 인증 (PASS처럼 한 번에 신원을 확인) */}
              <p className="pt-1 text-xs font-medium text-gray-500">본인 확인 (휴대폰 인증으로 실명·생년월일을 확인해요)</p>
              <Field label="실명">
                <input
                  className={inputClass}
                  value={realName}
                  disabled={phoneVerified}
                  onChange={(e) => {
                    setRealName(e.target.value);
                    resetIdentity();
                  }}
                  placeholder="주민등록증과 동일한 실명"
                />
              </Field>
              <Field label="생년월일">
                <input
                  className={inputClass}
                  type="date"
                  value={birth}
                  disabled={phoneVerified}
                  onChange={(e) => {
                    setBirth(e.target.value);
                    resetIdentity();
                  }}
                />
              </Field>

              {/* 휴대폰 본인인증 (가입 필수) */}
              <Field label="휴대폰 본인인증">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={phone}
                    inputMode="numeric"
                    disabled={phoneVerified}
                    onChange={(e) => changePhone(e.target.value)}
                    placeholder="010-1234-5678"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={phoneVerified}
                    className="flex-none rounded-lg bg-gray-800 px-3 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {otpSent ? '재전송' : '인증번호'}
                  </button>
                </div>
              </Field>

              {otpSent && !phoneVerified && (
                <Field label="인증번호 6자리">
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={otpCode}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="문자로 받은 번호"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="flex-none rounded-lg bg-orange-500 px-3 text-sm font-semibold text-white"
                    >
                      확인
                    </button>
                  </div>
                  {/* 개발용: 실서비스에선 이 번호가 문자로 발송됩니다 */}
                  {devCode && (
                    <p className="mt-1 text-xs text-gray-400">
                      개발용 인증번호: <b className="text-gray-600">{devCode}</b> (실서비스에선 문자로 발송)
                    </p>
                  )}
                </Field>
              )}

              {phoneVerified && (
                <p className="text-sm font-medium text-green-600">
                  ✅ 본인인증 완료 — {realName} · {birth}
                </p>
              )}
            </>
          )}

          {/* 3단계(학교·지역): 학교 권역·학교·졸업연도·실거주지 */}
          {mode === 'signup' && step === 2 && (
            <>
              {/* 시/도 → 권역 → 학교 를 순서대로 골라요 (직접 입력 X → 데이터 깔끔) */}
              <RegionSchoolPicker
                region={region}
                school={school}
                onChange={(r, s) => {
                  setRegion(r);
                  setSchool(s);
                }}
              />
              <Field label="졸업 연도">
                <input className={inputClass} value={gradYear} onChange={(e) => setGradYear(e.target.value)} placeholder="예: 2022" />
              </Field>

              {/* 실거주지 주소: 지역 인증(주민등록증) 때 관리자가 이 주소와 신분증을 대조합니다. */}
              <p className="pt-1 text-xs font-medium text-gray-500">실거주지</p>
              <Field label="거주지 주소">
                <input
                  className={inputClass}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="예: 경기도 수원시 영통구 매탄동 (동까지)"
                />
                <p className="mt-1 text-xs text-gray-400">📍 지역 인증 시 주민등록증 주소와 대조해요. 동(洞)까지 입력해 주세요.</p>
              </Field>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {mode === 'login' ? (
            <PrimaryButton full disabled={busy} onClick={handleLogin}>
              {busy ? '잠시만요...' : '로그인'}
            </PrimaryButton>
          ) : (
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(step - 1);
                  }}
                  className="flex-none rounded-xl border border-gray-300 px-5 text-sm font-medium text-gray-600"
                >
                  이전
                </button>
              )}
              {step < 2 ? (
                <PrimaryButton full onClick={next}>
                  다음
                </PrimaryButton>
              ) : (
                <PrimaryButton full disabled={busy || !phoneVerified} onClick={handleSignup}>
                  {busy ? '잠시만요...' : '회원가입'}
                </PrimaryButton>
              )}
            </div>
          )}
        </div>

        {/* 로그인 ↔ 회원가입 전환 */}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setStep(0); // 단계 처음으로
            setError(null);
            changePhone(''); // 본인인증 상태 초기화
            setRealName('');
            setBirth('');
            setAddress('');
          }}
          className="mt-4 w-full text-center text-sm text-gray-500"
        >
          {mode === 'login' ? '아직 회원이 아니신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
        </div>
      </div>
    </div>
  );
}
