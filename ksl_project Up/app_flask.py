from flask import Flask, render_template, jsonify, request, send_from_directory
import os
import json

app = Flask(__name__)

# 설정
app.config['SECRET_KEY'] = 'ksl-translator-secret-key'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# 데이터 디렉토리 설정 (프로젝트 내부로 통일)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
TRAINED_MODEL_DIR = os.path.join(BASE_DIR, 'trained-model')

# 필요한 디렉토리 생성
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(TRAINED_MODEL_DIR, exist_ok=True)

# 라우트
@app.route('/')
def index():
    """메인 페이지 - 워크스페이스로 리다이렉트"""
    return render_template('workspace.html')

@app.route('/workspace')
def workspace():
    """통합 워크스페이스 페이지"""
    return render_template('workspace.html')

@app.route('/api/model/info')
def model_info():
    """모델 정보 반환"""
    model_path = os.path.join(TRAINED_MODEL_DIR, 'model.json')
    has_trained_model = os.path.exists(model_path)

    return jsonify({
        'has_trained_model': has_trained_model,
        'model_path': model_path if has_trained_model else None,
        'supported_gestures': 32
    })

@app.route('/trained-model/<path:filename>')
def trained_model(filename):
    """학습된 모델 파일 서빙"""
    return send_from_directory(TRAINED_MODEL_DIR, filename)

@app.route('/static/<path:filename>')
def static_files(filename):
    """Static 파일 서빙 (CSS, JS 등)"""
    # Try static folder first
    static_path = os.path.join('static', filename)
    if os.path.exists(static_path):
        return send_from_directory('static', filename)
    # Try root directory for legacy files
    if os.path.exists(filename):
        return send_from_directory('.', filename)
    return '', 404

@app.route('/favicon.ico')
def favicon():
    """Favicon 처리 (404 에러 방지)"""
    return '', 204  # No Content

@app.route('/api/data/stats')
def data_stats():
    """데이터셋 통계 반환"""
    stats = {
        'total_gestures': 0,
        'total_samples': 0,
        'gestures': []
    }

    if os.path.exists(DATA_DIR):
        for root, dirs, files in os.walk(DATA_DIR):
            for file in files:
                if file.endswith('.json'):
                    try:
                        file_path = os.path.join(root, file)
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if 'dataset' in data and len(data['dataset']) > 0:
                                label = data['dataset'][0].get('label', 'Unknown')
                                count = len(data['dataset'])
                                stats['gestures'].append({
                                    'label': label,
                                    'count': count,
                                    'file': file
                                })
                                stats['total_samples'] += count
                    except Exception as e:
                        print(f"Error reading {file}: {e}")

        stats['total_gestures'] = len(stats['gestures'])

    return jsonify(stats)

@app.route('/api/collector/data', methods=['GET'])
def get_collected_data():
    """수집된 데이터 조회"""
    collected_file = os.path.join(DATA_DIR, 'collected_data.json')

    if os.path.exists(collected_file):
        try:
            with open(collected_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return jsonify(data)
        except Exception as e:
            print(f"Error reading collected data: {e}")
            return jsonify({'dataset': []})

    return jsonify({'dataset': []})

@app.route('/api/collector/save', methods=['POST'])
def save_collected_data():
    """수집된 데이터 저장"""
    try:
        data = request.get_json()
        collected_file = os.path.join(DATA_DIR, 'collected_data.json')

        with open(collected_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return jsonify({'success': True, 'message': '데이터가 저장되었습니다.'})

    except Exception as e:
        print(f"Error saving data: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/collector/reset', methods=['POST'])
def reset_collected_data():
    """전체 데이터 리셋 (모든 동작)"""
    try:
        collected_file = os.path.join(DATA_DIR, 'collected_data.json')

        # 빈 데이터셋으로 초기화
        with open(collected_file, 'w', encoding='utf-8') as f:
            json.dump({'dataset': []}, f, ensure_ascii=False, indent=2)

        return jsonify({'success': True, 'message': '전체 데이터가 리셋되었습니다.'})

    except Exception as e:
        print(f"Error resetting data: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/collector/reset/<gesture>', methods=['POST'])
def reset_gesture_data(gesture):
    """특정 동작의 데이터만 리셋"""
    try:
        collected_file = os.path.join(DATA_DIR, 'collected_data.json')

        # 기존 데이터 로드
        if os.path.exists(collected_file):
            with open(collected_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {'dataset': []}

        # 선택한 동작만 제외하고 필터링
        original_count = len(data['dataset'])
        data['dataset'] = [item for item in data['dataset'] if item.get('label') != gesture]
        removed_count = original_count - len(data['dataset'])

        # 저장
        with open(collected_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return jsonify({
            'success': True,
            'message': f'"{gesture}" 동작의 데이터 {removed_count}개가 삭제되었습니다.',
            'removed_count': removed_count
        })

    except Exception as e:
        print(f"Error resetting gesture data: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/models/list', methods=['GET'])
def list_models():
    """저장된 모델 목록 조회"""
    try:
        models = []

        if os.path.exists(TRAINED_MODEL_DIR):
            # 모델 메타데이터 파일 읽기
            metadata_file = os.path.join(TRAINED_MODEL_DIR, 'models_metadata.json')

            if os.path.exists(metadata_file):
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    models = metadata.get('models', [])

            # 실제 파일이 있는 모델만 필터링 (json과 weights 둘 다 확인)
            valid_models = []
            for model in models:
                model_json = os.path.join(TRAINED_MODEL_DIR, f"{model['name']}.json")
                model_weights = os.path.join(TRAINED_MODEL_DIR, f"{model['name']}.weights.bin")
                if os.path.exists(model_json) and os.path.exists(model_weights):
                    valid_models.append(model)

            return jsonify({
                'success': True,
                'models': valid_models
            })

        return jsonify({'success': True, 'models': []})

    except Exception as e:
        print(f"Error listing models: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/models/save', methods=['POST'])
def save_model_metadata():
    """모델 메타데이터 저장"""
    try:
        data = request.get_json()
        model_name = data.get('name')
        model_info = data.get('info', {})

        if not model_name:
            return jsonify({'success': False, 'message': '모델 이름이 필요합니다.'}), 400

        # 메타데이터 파일 읽기 또는 생성
        metadata_file = os.path.join(TRAINED_MODEL_DIR, 'models_metadata.json')

        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        else:
            metadata = {'models': []}

        # 새 모델 정보 추가 또는 업데이트
        existing_index = -1
        for i, model in enumerate(metadata['models']):
            if model['name'] == model_name:
                existing_index = i
                break

        model_data = {
            'name': model_name,
            'timestamp': model_info.get('timestamp'),
            'accuracy': model_info.get('accuracy', 0),
            'gestures': model_info.get('gestures', 0),
            'samples': model_info.get('samples', 0),
            'epochs': model_info.get('epochs', 0)
        }

        if existing_index >= 0:
            metadata['models'][existing_index] = model_data
        else:
            metadata['models'].append(model_data)

        # 저장
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        return jsonify({'success': True, 'message': '모델 정보가 저장되었습니다.'})

    except Exception as e:
        print(f"Error saving model metadata: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/models/upload', methods=['POST'])
def upload_model():
    """모델 파일 업로드 (TensorFlow.js 형식)"""
    try:
        data = request.get_json()
        model_name = data.get('modelTopology', {}).get('model_config', {}).get('name', 'unnamed_model')

        # URL에서 모델 이름 가져오기 (쿼리 파라미터)
        model_name = request.args.get('model_name', model_name)

        # model.json 파일 저장
        model_json_path = os.path.join(TRAINED_MODEL_DIR, f"{model_name}.json")

        # modelTopology와 weightsManifest만 저장
        model_data = {
            'modelTopology': data.get('modelTopology'),
            'format': data.get('format', 'tfjs-graph-model'),
            'generatedBy': data.get('generatedBy', 'TensorFlow.js'),
            'convertedBy': data.get('convertedBy'),
            'weightsManifest': [{
                'paths': [f'{model_name}.weights.bin'],
                'weights': data.get('weightsManifest', [{}])[0].get('weights', [])
            }]
        }

        with open(model_json_path, 'w', encoding='utf-8') as f:
            json.dump(model_data, f, ensure_ascii=False, indent=2)

        print(f"모델 토폴로지 저장 완료: {model_json_path}")

        return jsonify({
            'success': True,
            'message': 'Model topology saved successfully',
            'modelArtifactsInfo': {
                'dateSaved': data.get('modelArtifactsInfo', {}).get('dateSaved'),
                'modelTopologyType': 'JSON'
            }
        })

    except Exception as e:
        print(f"Error uploading model: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/models/upload-weights', methods=['POST'])
def upload_weights():
    """모델 가중치 업로드 (바이너리)"""
    try:
        model_name = request.args.get('model_name', 'unnamed_model')

        # 바이너리 데이터 받기
        weights_data = request.get_data()

        # weights.bin 파일 저장
        weights_path = os.path.join(TRAINED_MODEL_DIR, f"{model_name}.weights.bin")

        with open(weights_path, 'wb') as f:
            f.write(weights_data)

        print(f"모델 가중치 저장 완료: {weights_path} ({len(weights_data)} bytes)")

        return jsonify({
            'success': True,
            'message': 'Weights saved successfully'
        })

    except Exception as e:
        print(f"Error uploading weights: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/models/rename', methods=['POST'])
def rename_model():
    """모델 이름 변경"""
    try:
        data = request.get_json()
        old_name = data.get('old_name')
        new_name = data.get('new_name')

        if not old_name or not new_name:
            return jsonify({'success': False, 'message': '이전 이름과 새 이름이 필요합니다.'}), 400

        # 파일 경로
        old_json = os.path.join(TRAINED_MODEL_DIR, f"{old_name}.json")
        old_weights = os.path.join(TRAINED_MODEL_DIR, f"{old_name}.weights.bin")
        new_json = os.path.join(TRAINED_MODEL_DIR, f"{new_name}.json")
        new_weights = os.path.join(TRAINED_MODEL_DIR, f"{new_name}.weights.bin")

        # 새 이름이 이미 존재하는지 확인
        if os.path.exists(new_json):
            return jsonify({'success': False, 'message': f'"{new_name}"이라는 이름의 모델이 이미 존재합니다.'}), 400

        # 파일 이름 변경
        renamed_files = []
        if os.path.exists(old_json):
            # JSON 파일을 읽어서 weightsManifest의 paths를 업데이트
            with open(old_json, 'r', encoding='utf-8') as f:
                model_json = json.load(f)

            # weightsManifest의 paths를 새 이름으로 업데이트
            if 'weightsManifest' in model_json:
                for manifest in model_json['weightsManifest']:
                    if 'paths' in manifest:
                        manifest['paths'] = [f"{new_name}.weights.bin"]

            # 업데이트된 내용으로 새 파일 저장
            with open(new_json, 'w', encoding='utf-8') as f:
                json.dump(model_json, f, ensure_ascii=False, indent=2)

            # 원본 JSON 파일 삭제
            os.remove(old_json)
            renamed_files.append('json')

        if os.path.exists(old_weights):
            os.rename(old_weights, new_weights)
            renamed_files.append('weights')

        # 메타데이터 업데이트
        metadata_file = os.path.join(TRAINED_MODEL_DIR, 'models_metadata.json')
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            for model in metadata['models']:
                if model['name'] == old_name:
                    model['name'] = new_name
                    break

            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

        return jsonify({
            'success': True,
            'message': f'모델 이름이 "{old_name}"에서 "{new_name}"으로 변경되었습니다.',
            'renamed_files': renamed_files
        })

    except Exception as e:
        print(f"Error renaming model: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/models/delete/<model_name>', methods=['DELETE'])
def delete_model(model_name):
    """모델 삭제"""
    try:
        # 모델 파일 삭제
        model_json = os.path.join(TRAINED_MODEL_DIR, f"{model_name}.json")
        model_weights = os.path.join(TRAINED_MODEL_DIR, f"{model_name}.weights.bin")

        deleted_files = []
        if os.path.exists(model_json):
            os.remove(model_json)
            deleted_files.append('json')
        if os.path.exists(model_weights):
            os.remove(model_weights)
            deleted_files.append('weights')

        # 메타데이터에서 제거
        metadata_file = os.path.join(TRAINED_MODEL_DIR, 'models_metadata.json')
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            metadata['models'] = [m for m in metadata['models'] if m['name'] != model_name]

            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

        return jsonify({
            'success': True,
            'message': f'모델 "{model_name}"이(가) 삭제되었습니다.',
            'deleted_files': deleted_files
        })

    except Exception as e:
        print(f"Error deleting model: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# --- Korean naturalizer helpers and API ---
def has_jongsung(syllable):
    if not syllable:
        return False
    ch = syllable[-1]
    code = ord(ch)
    if 0xAC00 <= code <= 0xD7A3:
        jong = (code - 0xAC00) % 28
        return jong != 0
    return False


def add_jong_n_to_last(s):
    # add jong 'ㄴ' (index 4) to last syllable if possible
    if not s:
        return s
    ch = s[-1]
    code = ord(ch)
    if 0xAC00 <= code <= 0xD7A3:
        base = code - 0xAC00
        initial = base // 588
        medial = (base % 588) // 28
        new_code = 0xAC00 + initial*588 + medial*28 + 4  # 4 == ㄴ
        return s[:-1] + chr(new_code)
    return s + 'ㄴ'


def conj_particle(prev_word):
    return '과' if has_jongsung(prev_word) else '와'


def obj_particle(last_word):
    return '을' if has_jongsung(last_word) else '를'


def conjugate_present_plain(verb):
    # verb expected like '먹다', '가다'
    if not verb.endswith('다'):
        return verb
    stem = verb[:-1]
    if has_jongsung(stem):
        return stem + '는다'
    else:
        stem2 = add_jong_n_to_last(stem)
        return stem2 + '다'


def naturalize(subject, objects, verb):
    subj = subject
    if subject == '나':
        subj = '내가'
    else:
        subj = subject + ('이' if has_jongsung(subject) else '가')

    if not objects:
        obj_phrase = ''
    elif len(objects) == 1:
        obj_phrase = objects[0] + obj_particle(objects[0])
    else:
        if len(objects) == 2:
            conj = conj_particle(objects[0])
            obj_phrase = f"{objects[0]}{conj} {objects[1]}{obj_particle(objects[-1])}"
        else:
            firsts = ', '.join(objects[:-1])
            conj = conj_particle(objects[-2])
            obj_phrase = f"{firsts}{conj} {objects[-1]}{obj_particle(objects[-1])}"

    verb_form = conjugate_present_plain(verb)
    if obj_phrase:
        return f"{subj} {obj_phrase} {verb_form}"
    else:
        return f"{subj} {verb_form}"


@app.route('/api/naturalize', methods=['POST'])
def api_naturalize():
    """간단한 한국어 자연문 생성 API
    요청 JSON 예시: {"subject":"나", "objects":["밥","물"], "verb":"먹다"}
    반환: {"success": True, "result": "내가 밥과 물을 먹는다"}
    """
    try:
        data = request.get_json() or {}
        subject = data.get('subject')
        objects = data.get('objects', [])
        verb = data.get('verb')

        if not subject or not verb:
            return jsonify({'success': False, 'message': 'subject와 verb가 필요합니다.'}), 400

        if isinstance(objects, str):
            # 쉼표로 구분된 문자열인 경우 처리
            objects = [o.strip() for o in objects.split(',') if o.strip()]

        sentence = naturalize(subject, objects, verb)
        return jsonify({'success': True, 'result': sentence})

    except Exception as e:
        print(f"Error in naturalize API: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    """404 에러 처리"""
    return jsonify({
        'error': '404 Not Found',
        'message': 'The requested resource was not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """500 에러 처리"""
    return jsonify({
        'error': '500 Internal Server Error',
        'message': 'An internal error occurred'
    }), 500

if __name__ == '__main__':
    print('=' * 50)
    print('   KSL 수어 통역 시스템')
    print('   통합 워크스페이스')
    print('=' * 50)
    print('')
    print('>> 서버 시작 중...')
    print('>> 주소: http://localhost:5000')
    print('')
    print('사용 가능한 페이지:')
    print('  - http://localhost:5000/          : 워크스페이스 (메인)')
    print('  - http://localhost:5000/workspace : 워크스페이스')
    print('')
    print('종료하려면 Ctrl+C를 누르세요.')
    print('')

    app.run(debug=True, host='0.0.0.0', port=5000)
