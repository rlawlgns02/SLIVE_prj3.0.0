# SLIVE

수어 실시간 통역 시스템

## 📋 프로젝트 소개

SLIVE는 AI 기반 한국 수어 인식 및 실시간 통역 시스템입니다. MediaPipe와 TensorFlow.js를 활용하여 웹캠을 통해 수어를 인식하고 텍스트로 변환합니다.

## ✨ 주요 기능

### 1. 데이터 수집 📊
- 웹캠을 통한 실시간 손 동작 캡처
- 30개 이상의 수어 제스처 지원
- 자동 저장 및 진행률 추적
- 목표 데이터셋 수량 설정 가능

### 2. 모델 학습 🧠
- TensorFlow.js 기반 딥러닝 모델
- 실시간 학습 진행률 및 정확도 표시
- 다양한 학습 프리셋 제공
- 학습 중 실시간 그래프 표시

### 3. 실시간 통역 🤟
- 웹캠 기반 실시간 수어 인식
- 높은 정확도의 인식 결과
- 상위 5개 예측 결과 표시
- 인식 기록 및 신뢰도 표시
- 실시간 음성 출력(TTS) 기능: 인식된 결과를 브라우저 음성으로 재생 (번역/대화 탭 별도 토글 제공)

### 4. 모델 관리 ⚙️
- 여러 모델 저장 및 관리
- 모델 이름 변경 및 삭제
- 모델 성능 비교
- 모델 경쟁 모드

## 🚀 설치 및 실행

### 필요 사항
- Python 3.8 이상
- 웹캠
- 최신 웹 브라우저 (Chrome, Firefox, Edge 등)

### 설치

```bash
# 저장소 클론
git clone https://github.com/rlawlgns02/SLIVE_prj

# 필요한 패키지 설치
pip install flask flask-cors
```

### TTS(음성 재생) 사용법
1. 실시간 통역(TAB)에 있는 `음성(TTS)` 토글을 활성화하면 인식된 레이블이 음성으로 재생됩니다.
2. 대화 번역(TAB)에서도 `음성(TTS)` 토글을 활성화하면 인식 단어 및 생성된 문장이 음성으로 재생됩니다.
3. 브라우저가 Web Speech API(SpeechSynthesis)를 지원하지 않을 경우 토글이 비활성화됩니다.
4. 토글 상태는 로컬 스토리지를 통해 유지되며, 다음 키가 사용됩니다:
   - `ksl_tts_translate` (translate 탭)
   - `ksl_tts_conversation` (conversation 탭)

### 낮은 신뢰도(미학습) 처리
1. 대화 번역 탭과 실시간 통역 탭 모두 동일한 기준(최소 신뢰도 93% — 0.93)을 사용합니다. 그 이하의 확률로 예측된 결과는 무시됩니다.
2. 대화 탭에서 신뢰도가 낮은 제스처는 자동으로 무시되며, UI에 잠깐 `학습되지 않은 동작입니다` 메시지가 표시됩니다.

```
- 대화 번역 탭의 신뢰도 기준을 실시간 통역과 동일하게 0.93으로 맞추었습니다(이전: 0.7).
- 실시간 통역 및 대화 번역에 TTS(음성) 재생 기능 추가 및 UI 토글 구현(번역/대화 탭 별도 제어, 로컬 스토리지에 설정 저장).
- 대화 탭에서 낮은 신뢰도 제스처를 무시하고 즉시 사용자에게 알림을 보여줍니다(스팸 방지용 최소 간격 적용).
- 번역 탭과 대화 탭에서 TTS가 활성화된 경우 인식된 단어/문장을 자동으로 읽습니다. 기본 언어는 `ko-KR`입니다.


- 변경된 파일:
  - `static/workspace.js` — TTS 헬퍼(speakText), UI 토글 로직, 신뢰도 기준(0.93) 업데이트, TTS 표시 뱃지 추가
  - `templates/workspace.html` — translate / conversation 탭에 `음성(TTS)` 토글 UI 추가
  - `static/css/styles.css` — TTS 뱃지 스타일 추가
- 로컬 스토리지 키:
  - `ksl_tts_translate` — translate 탭 TTS 상태
  - `ksl_tts_conversation` — conversation 탭 TTS 상태
- TTS 동작은 브라우저의 Web Speech API(SpeechSynthesis)를 사용하며, 음성(voice), 속도(rate), 음높이(pitch) 설정은 코드에서 고정값(기본값)으로 사용됩니다. UI에서 음성 선택 또는 속도 변경 기능을 추가하려면 `workspace.js`의 `speakText` 메서드와 UI를 확장하면 됩니다.

### 실행

```bash
# Flask 서버 시작
python app_flask.py
```

브라우저에서 `http://localhost:5000` 접속

## 📁 프로젝트 구조

```
SLIVE/
├── app_flask.py          # Flask 백엔드 서버
├── requirements.txt      # Python 패키지 의존성
├── templates/            # HTML 템플릿
│   └── workspace.html   # 통합 워크스페이스
├── static/              # 정적 파일
│   ├── css/
│   │   └── styles.css   # 스타일시트
│   ├── js/
│   │   └── model.js     # AI 모델 클래스
│   └── workspace.js     # 워크스페이스 로직
├── trained-model/       # 학습된 모델 저장 (git에서 제외)
└── data/               # 학습 데이터 (git에서 제외)
```

## 🎯 지원되는 수어 제스처

- **인사**: 안녕하세요, 감사합니다, 미안합니다, 잘가
- **감정**: 좋아요, 싫어요, 사랑해요
- **동작**: 확인, 평화, 멈춰, 와, 가
- **숫자**: 하나~열 (1-10)
- **기타**: 주먹, 가리키기, 물, 밥, 도와주세요, 전화, 락

## 🛠️ 기술 스택

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **AI/ML**:
  - TensorFlow.js
  - MediaPipe Hands
- **기타**: Chart.js (데이터 시각화)

## 📊 모델 구조

- Input: 21 hand landmarks × 3 coordinates (x, y, z)
- Architecture:
  - Flatten Layer
  - Dense (256) + BatchNorm + Dropout
  - Dense (128) + BatchNorm + Dropout
  - Dense (64) + BatchNorm + Dropout
  - Dense (32) - Softmax
- Optimizer: Adam
- Loss: Categorical Crossentropy

## 🎮 사용 방법

### 1. 데이터 수집
1. "데이터 수집" 탭으로 이동
2. 수집할 제스처 선택
3. "카메라 시작" 클릭
4. "녹화 시작" 클릭하여 데이터 수집
5. 충분한 데이터 수집 후 저장

### 2. 모델 학습
1. "모델 학습" 탭으로 이동
2. 학습 파라미터 설정 (또는 프리셋 선택)
3. 모델 이름 입력 (선택사항)
4. "학습 시작" 클릭
5. 학습 완료 대기

### 3. 실시간 통역
1. "실시간 통역" 탭으로 이동
2. 사용할 모델 선택
3. "통역 시작" 클릭
4. 수어 제스처 수행


## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 👨‍💻 개발자

HandCode Team

## 🙏 감사의 말

- MediaPipe - 손 랜드마크 감지
- TensorFlow.js - 브라우저 기반 머신러닝
- Flask - 웹 프레임워크

---

**Note**: 이 프로젝트는 교육 및 연구 목적으로 개발되었습니다.


