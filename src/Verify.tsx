// ============================================================
// 인증 화면입니다. (대학 인증 🎓 / 지역 인증 📍)
//  - 인증은 "필수"가 아니라 "선택"이에요. 안 해도 모든 기능을 쓸 수 있고,
//    인증하면 닉네임 옆에 배지가 붙습니다. (대학·지역 둘 다 인증 가능)
//  - 대학교 이메일 인증: 학교 이메일로 코드를 받아 입력 → "바로" 인증 완료 (관리자 승인 불필요)
//  - 그 외 수단(재학/졸업증명서, 졸업앨범, 학생증, 지역=주민등록증): 사진 제출 → 관리자 심사 후 배지
//  - 지역 인증(주민등록증)은 주민번호 뒷자리를 반드시 가리고 제출
// ============================================================
import {useState} from 'react';
import {useStore} from './data';
import {useNav} from './nav';
import {REGION_VERIFY_METHODS, SCHOOL_VERIFY_METHODS, type VerifyType} from './types';
import {DISTRICT_TREE} from './districts';
import {ImagePicker, Page, PrimaryButton, inputClass} from './ui';

export function VerifyScreen() {
  const {verifications, session, submitVerification, resetVerification, me, sendEmailOtp, verifyEmailOtp} = useStore();
  const nav = useNav();

  const [type, setType] = useState<VerifyType>('대학'); // 지금 신청하는 인증 종류
  const [method, setMethod] = useState<string>(SCHOOL_VERIFY_METHODS.main[0]); // 선택한 수단
  const [cert, setCert] = useState<string>(); // 첨부 사진
  // 지역 인증용: 정확한 위치 (시/도 → 시군구). 예: '경기도' + '수원시'
  const [regionSido, setRegionSido] = useState<string>(DISTRICT_TREE[0].sido);
  const [regionGu, setRegionGu] = useState<string>('');

  // 대학교 이메일 인증용 상태 (학교 이메일로 코드 받아 입력)
  const [schoolEmail, setSchoolEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailDevCode, setEmailDevCode] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const isEmailMethod = type === '대학' && method === '대학교 이메일';
  const isRegion = type === '지역';

  // 내가 낸 요청 중, 지금 고른 종류(대학/지역)의 가장 최근 것
  const myReq = (verifications ?? []).find((v) => v.userId === session && v.type === type);
  const pending = myReq?.status === '대기';
  // 인증 완료 판단: 본인(me) 기준 (이메일 인증은 관리자 승인 없이 바로 완료되므로 me 로 확인)
  const alreadyVerified = type === '대학' ? me.verified === true : me.regionVerified === true;
  const approved = alreadyVerified || myReq?.status === '승인';

  function resetEmail() {
    setSchoolEmail('');
    setEmailSent(false);
    setEmailCode('');
    setEmailDevCode(null);
    setEmailMsg(null);
  }

  // 종류를 바꾸면 그 종류의 기본 수단으로 맞춰줍니다.
  function changeType(next: VerifyType) {
    setType(next);
    setMethod(next === '대학' ? SCHOOL_VERIFY_METHODS.main[0] : REGION_VERIFY_METHODS[0]);
    setCert(undefined);
    resetEmail();
  }

  // 수단을 바꾸면 첨부한 사진/이메일 입력은 초기화
  function changeMethod(next: string) {
    setMethod(next);
    setCert(undefined);
    resetEmail();
  }

  // 학교 이메일을 고치면 인증을 처음부터
  function changeSchoolEmail(v: string) {
    setSchoolEmail(v);
    setEmailSent(false);
    setEmailCode('');
    setEmailDevCode(null);
    setEmailMsg(null);
  }

  function handleSubmit() {
    if (approved) {
      window.alert('이미 인증이 완료된 항목이에요.');
      return;
    }
    if (!cert) {
      window.alert('인증 사진을 첨부해 주세요.');
      return;
    }
    // 지역 인증은 정확한 위치(시/도 + 시군구)를 골라야 제출할 수 있어요.
    if (isRegion && !regionGu) {
      window.alert('거주 지역(시/군/구)을 선택해 주세요.');
      return;
    }
    const regionCity = isRegion ? `${regionSido} ${regionGu}` : undefined;
    submitVerification(type, method, cert, regionCity);
    window.alert('인증 서류를 제출했어요. 관리자 심사 후 배지가 부여됩니다.');
    nav.pop();
  }

  // 학교 이메일로 인증코드 보내기 / 확인
  async function handleSendEmailOtp() {
    setEmailMsg(null);
    const r = await sendEmailOtp(schoolEmail);
    if (!r.ok) return setEmailMsg(r.error ?? '인증코드 전송에 실패했어요.');
    setEmailSent(true);
    setEmailDevCode(r.devCode ?? null);
  }
  async function handleVerifyEmailOtp() {
    const msg = await verifyEmailOtp(schoolEmail, emailCode);
    if (msg) return setEmailMsg(msg);
    window.alert('대학교 이메일 인증이 완료됐어요! 🎓');
    nav.pop();
  }

  // 인증 변경: 초기화하면 다시 인증해야 한다고 경고한 뒤 해제
  // (지역은 '인증 지역 변경', 대학은 '인증 방법 변경')
  function handleChangeMethod() {
    const what = isRegion ? '인증 지역' : '인증 방법';
    if (
      window.confirm(
        `${type} ${what}을 변경하면 지금 인증이 초기화돼요. 처음부터 다시 인증해야 하는데 계속할까요?`,
      )
    ) {
      resetVerification(type);
    }
  }

  return (
    <Page
      title="인증하기"
      onBack={nav.pop}
      // 이메일 인증은 화면 안의 '확인' 버튼으로 바로 완료되므로 하단 제출 버튼을 두지 않습니다.
      footer={
        isEmailMethod || approved ? undefined : (
          <PrimaryButton full onClick={handleSubmit}>
            {pending ? '다시 제출하기' : '인증 제출하기'}
          </PrimaryButton>
        )
      }
    >
      <div className="space-y-4 p-4">
        {/* 인증은 선택사항이라는 안내 */}
        <div className="rounded-xl bg-orange-50 p-4 text-sm text-orange-700">
          <p className="font-semibold">인증하면 닉네임 옆에 배지가 붙어요 🎉</p>
          <p className="mt-1">
            대학·지역 <b>둘 다</b> 인증할 수 있어요. 인증 수단도 배지에 표시돼서, 증명서로 인증하면 더 확실한 회원으로 보여요.
          </p>
        </div>

        {/* 대학 / 지역 선택 탭 */}
        <div className="flex gap-2">
          {(['대학', '지역'] as VerifyType[]).map((t) => (
            <button
              key={t}
              onClick={() => changeType(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                type === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t === '대학' ? '🎓 대학 인증' : '📍 지역 인증'}
            </button>
          ))}
        </div>

        {/* 이미 인증된 항목이면 안내 */}
        {approved ? (
          <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
            <p className="font-semibold">이미 인증되었어요 ✅</p>
            <p className="mt-1">{type} 인증 배지가 닉네임 옆에 표시되고 있어요.</p>
            <button
              onClick={handleChangeMethod}
              className="mt-2 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 active:bg-green-50"
            >
              {isRegion ? '인증 지역 변경하기' : '인증 방법 변경하기'}
            </button>
            <p className="mt-1 text-xs text-green-600">
              {isRegion
                ? '※ 변경하면 지역 인증이 초기화되고 새 지역으로 다시 인증해야 해요.'
                : '※ 변경하면 인증이 초기화되고 다시 인증해야 해요.'}
            </p>
          </div>
        ) : pending ? (
          <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
            <p className="font-semibold">심사 대기 중이에요 ⏳</p>
            <p className="mt-1">관리자가 제출하신 서류를 확인하고 있어요. 승인되면 배지가 부여됩니다.</p>
          </div>
        ) : myReq?.status === '거절' ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">인증이 거절되었어요</p>
            {myReq.rejectReason ? (
              <p className="mt-1">사유: {myReq.rejectReason}</p>
            ) : (
              <p className="mt-1">서류를 다시 확인해 제출해 주세요.</p>
            )}
          </div>
        ) : null}

        {/* 이미 인증된 종류면 입력 폼은 숨깁니다 (다른 종류는 위 탭에서 선택해 인증 가능) */}
        {!approved && (
          <>
            {/* 인증 수단 선택 */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="mb-2 text-sm font-semibold text-gray-900">인증 수단 선택</p>

              {type === '대학' ? (
                <div className="space-y-3">
                  <MethodGroup
                    label="메인 수단 (가장 확실해요)"
                    options={SCHOOL_VERIFY_METHODS.main}
                    value={method}
                    onChange={changeMethod}
                  />
                  <MethodGroup
                    label="보조 수단 (메인 서류가 없을 때)"
                    options={SCHOOL_VERIFY_METHODS.sub}
                    value={method}
                    onChange={changeMethod}
                  />
                </div>
              ) : (
                <MethodGroup
                  label="제출 서류"
                  options={REGION_VERIFY_METHODS}
                  value={method}
                  onChange={changeMethod}
                />
              )}
            </div>

            {/* 졸업증명서 진위확인 바로가기 (증명서 수단일 때만) */}
            {(method === '재학증명서' || method === '졸업증명서') && (
              <a
                href="https://unc.doculink.co.kr/index/main.do#reload"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm active:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">🔎 증명서 진위확인 하러 가기</p>
                  <p className="mt-0.5 text-xs text-gray-500">DocuLink 에서 진위확인 후 그 증명서를 첨부하세요</p>
                </div>
                <span className="text-orange-500">›</span>
              </a>
            )}

            {isEmailMethod ? (
              /* 대학교 이메일 인증: 학교 이메일로 코드 받아 입력 → 바로 인증 */
              <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-gray-900">학교 이메일 인증</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    학교 전용 이메일(@xxx.ac.kr)로 인증코드를 보내드려요. 받은 코드를 입력하면 바로 인증돼요.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={schoolEmail}
                    onChange={(e) => changeSchoolEmail(e.target.value)}
                    placeholder="학번@xxx.ac.kr"
                  />
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    className="flex-none rounded-lg bg-gray-800 px-3 text-sm font-medium text-white"
                  >
                    {emailSent ? '재전송' : '코드 받기'}
                  </button>
                </div>
                {emailSent && (
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={emailCode}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(e) => setEmailCode(e.target.value)}
                      placeholder="인증코드 6자리"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyEmailOtp}
                      className="flex-none rounded-lg bg-orange-500 px-3 text-sm font-semibold text-white"
                    >
                      확인
                    </button>
                  </div>
                )}
                {/* 개발용: 실서비스에선 이 코드가 메일로 발송됩니다 */}
                {emailDevCode && (
                  <p className="text-xs text-gray-400">
                    개발용 인증코드: <b className="text-gray-600">{emailDevCode}</b> (실서비스에선 메일로 발송)
                  </p>
                )}
                {emailMsg && <p className="text-sm text-red-500">{emailMsg}</p>}
              </div>
            ) : (
              /* 그 외 수단: 사진 첨부 → 관리자 심사 */
              <div className="rounded-xl bg-white p-4 shadow-sm">
                {/* 지역 인증: 정확한 위치를 시/도 → 시군구 순으로 골라요 (예: 경기도 수원시) */}
                {isRegion && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-sm font-medium text-gray-700">거주 지역 (주민등록증과 동일하게)</p>
                    <div className="flex gap-2">
                      <select
                        className={inputClass}
                        value={regionSido}
                        onChange={(e) => {
                          setRegionSido(e.target.value);
                          setRegionGu(''); // 시/도를 바꾸면 시군구는 다시 선택
                        }}
                      >
                        {DISTRICT_TREE.map((d) => (
                          <option key={d.sido} value={d.sido}>
                            {d.sido}
                          </option>
                        ))}
                      </select>
                      <select className={inputClass} value={regionGu} onChange={(e) => setRegionGu(e.target.value)}>
                        <option value="">시/군/구 선택</option>
                        {(DISTRICT_TREE.find((d) => d.sido === regionSido)?.districts ?? []).map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    {regionGu && <p className="mt-1 text-xs text-gray-500">선택: {regionSido} {regionGu} → 배지엔 ‘{regionGu.replace(/(시|군|구)$/u, '')}’ 로 표시돼요.</p>}
                  </div>
                )}
                <ImagePicker label={`${method} 사진`} value={cert} onChange={setCert} />
                {isRegion ? (
                  <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600">
                    ⚠️ 주민등록증의 <b>주민번호 뒷자리(생년월일 뒤 7자리)는 반드시 가리고</b> 촬영해 주세요. 가리지 않은 서류는 거절됩니다.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">허위 서류 제출 시 이용이 제한되며 관련 책임을 질 수 있습니다.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
}

// 인증 수단 라디오 묶음 (하나만 선택)
function MethodGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-500">{label}</p>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              value === opt ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-700'
            }`}
          >
            <input
              type="radio"
              name="verify-method"
              className="accent-orange-500"
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}
