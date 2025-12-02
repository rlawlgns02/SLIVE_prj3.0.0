/**
 * SLIVE - 3D Hand Viewer Module
 * MediaPipe Hands + Three.js를 사용한 실시간 손 스켈레톤 3D 시각화
 */

class HandViewer3D {
    constructor() {
        // MediaPipe
        this.hands = null;
        this.camera = null;

        // Video element (needed for MediaPipe)
        this.video = null;

        // Three.js
        this.scene = null;
        this.camera3D = null;
        this.renderer = null;
        this.grid = null;
        this.axisHelper = null;

        // Hand skeleton
        this.handSkeletonGroup = null;
        this.landmarkMeshes = [];
        this.connectionLines = [];

        // Hand avatar (3D mesh)
        this.handAvatarGroup = null;
        this.fingerSegments = [];
        this.jointSpheres = [];
        this.showAvatar = true;

        // Settings
        this.autoRotate = false;
        this.showGrid = true;
        this.landmarkColor = 0xff4444;
        this.connectionColor = 0x00ff88;
        this.landmarkSize = 0.05;
        this.scale3D = 4;

        // State
        this.isRunning = false;
        this.currentLandmarks = null;

        // FPS tracking
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.animationId = null;
    }

    async init() {
        console.log('Initializing 3D Hand Viewer...');

        // Get video element (hidden, used by MediaPipe)
        this.video = document.getElementById('video3D');

        if (!this.video) {
            console.error('Video element not found');
            return false;
        }

        // Initialize Three.js
        if (!this.init3DScene()) {
            console.error('Failed to initialize 3D scene');
            return false;
        }

        // Initialize MediaPipe Hands
        await this.initMediaPipe();

        // Setup controls
        this.setupControls();

        console.log('3D Hand Viewer initialized successfully');
        return true;
    }

    init3DScene() {
        const canvas3D = document.getElementById('viewer3dCanvas');
        if (!canvas3D) {
            console.error('3D Canvas not found');
            return false;
        }

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);

        // Camera setup
        const container = canvas3D.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera3D = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera3D.position.set(0, 0, 5);
        this.camera3D.lookAt(0, 0, 0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas3D,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.4);
        pointLight.position.set(-5, 3, 5);
        this.scene.add(pointLight);

        // Grid
        this.grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
        this.scene.add(this.grid);

        // Axis helper
        this.axisHelper = new THREE.AxesHelper(3);
        this.scene.add(this.axisHelper);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Setup mouse controls
        this.setupMouseControls();

        // Start render loop
        this.animate();

        return true;
    }

    async initMediaPipe() {
        // Initialize MediaPipe Hands
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onHandsResults(results));

        console.log('MediaPipe Hands initialized');
    }

    async startCamera() {
        if (this.isRunning) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 }
            });

            this.video.srcObject = stream;

            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });

            // Initialize MediaPipe camera
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    await this.hands.send({ image: this.video });
                },
                width: 1280,
                height: 720
            });

            await this.camera.start();
            this.isRunning = true;

            // Update UI
            this.updateStatus('실행 중', true);
            document.getElementById('start3DBtn').disabled = true;
            document.getElementById('stop3DBtn').disabled = false;

            console.log('Camera started');
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('카메라를 시작할 수 없습니다: ' + error.message);
        }
    }

    stopCamera() {
        if (!this.isRunning) return;

        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }

        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }

        this.isRunning = false;
        this.clearHand3D();

        // Update UI
        this.updateStatus('정지됨', false);
        document.getElementById('start3DBtn').disabled = false;
        document.getElementById('stop3DBtn').disabled = true;
        this.updateHandDetection(false);

        console.log('Camera stopped');
    }

    onHandsResults(results) {
        // Update 3D visualization only (no 2D rendering)
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.currentLandmarks = results.multiHandLandmarks[0]; // Use first hand
            this.updateHand3D(this.currentLandmarks);
            this.updateHandDetection(true, results.multiHandLandmarks.length);

            // Update landmarks count
            const landmarksCount = document.getElementById('landmarks3DCount');
            if (landmarksCount) {
                landmarksCount.textContent = this.currentLandmarks.length;
            }
        } else {
            this.currentLandmarks = null;
            this.clearHand3D();
            this.updateHandDetection(false);

            const landmarksCount = document.getElementById('landmarks3DCount');
            if (landmarksCount) {
                landmarksCount.textContent = '0';
            }
        }
    }

    updateHand3D(landmarks) {
        // Create or update hand skeleton group
        if (!this.handSkeletonGroup) {
            this.handSkeletonGroup = new THREE.Group();
            this.scene.add(this.handSkeletonGroup);
        } else {
            // Clear existing meshes and lines
            this.landmarkMeshes.forEach(mesh => {
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            });
            this.connectionLines.forEach(line => {
                if (line.geometry) line.geometry.dispose();
                if (line.material) line.material.dispose();
            });
            this.handSkeletonGroup.clear();
            this.landmarkMeshes = [];
            this.connectionLines = [];
        }

        // Convert landmarks to 3D positions
        const positions = landmarks.map(landmark => new THREE.Vector3(
            (landmark.x - 0.5) * this.scale3D,
            (0.5 - landmark.y) * this.scale3D,
            -landmark.z * this.scale3D
        ));

        // Create landmark spheres
        const sphereGeometry = new THREE.SphereGeometry(this.landmarkSize, 16, 16);
        const sphereMaterial = new THREE.MeshPhongMaterial({
            color: this.landmarkColor,
            emissive: this.landmarkColor,
            emissiveIntensity: 0.3
        });

        positions.forEach(pos => {
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.copy(pos);
            this.handSkeletonGroup.add(sphere);
            this.landmarkMeshes.push(sphere);
        });

        // Create connection lines
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],      // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],      // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]            // Palm
        ];

        const lineMaterial = new THREE.LineBasicMaterial({
            color: this.connectionColor,
            linewidth: 2
        });

        for (const [start, end] of connections) {
            const points = [positions[start], positions[end]];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeometry, lineMaterial);
            this.handSkeletonGroup.add(line);
            this.connectionLines.push(line);
        }

        // Create hand avatar (realistic 3D mesh)
        if (this.showAvatar) {
            this.createHandAvatar(positions);
        }
    }

    createHandAvatar(positions) {
        // Clear previous avatar
        if (this.handAvatarGroup) {
            this.fingerSegments.forEach(seg => {
                if (seg.geometry) seg.geometry.dispose();
                if (seg.material) seg.material.dispose();
            });
            this.jointSpheres.forEach(sphere => {
                if (sphere.geometry) sphere.geometry.dispose();
                if (sphere.material) sphere.material.dispose();
            });
            this.scene.remove(this.handAvatarGroup);
        }

        this.handAvatarGroup = new THREE.Group();
        this.fingerSegments = [];
        this.jointSpheres = [];

        // Skin-like material
        const skinMaterial = new THREE.MeshPhongMaterial({
            color: 0xffdbac,
            specular: 0x111111,
            shininess: 30,
            transparent: true,
            opacity: 0.95
        });

        const jointMaterial = new THREE.MeshPhongMaterial({
            color: 0xffc896,
            specular: 0x111111,
            shininess: 20
        });

        // Define finger segments (connections between landmarks)
        const fingerSegments = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [5, 6], [6, 7], [7, 8],
            // Middle finger
            [9, 10], [10, 11], [11, 12],
            // Ring finger
            [13, 14], [14, 15], [15, 16],
            // Pinky
            [17, 18], [18, 19], [19, 20],
            // Palm connections
            [0, 5], [5, 9], [9, 13], [13, 17], [0, 17]
        ];

        // Create cylinders for each finger segment
        fingerSegments.forEach(([startIdx, endIdx]) => {
            const start = positions[startIdx];
            const end = positions[endIdx];

            // Calculate segment properties
            const direction = new THREE.Vector3().subVectors(end, start);
            const length = direction.length();
            const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

            // Determine radius based on position (thicker at palm, thinner at fingertips)
            let radius;
            if ([0, 5, 9, 13, 17].includes(startIdx)) {
                radius = this.landmarkSize * 2.5; // Palm segments
            } else if ([4, 8, 12, 16, 20].includes(endIdx)) {
                radius = this.landmarkSize * 1.2; // Fingertip segments
            } else {
                radius = this.landmarkSize * 1.8; // Middle segments
            }

            // Create cylinder
            const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
            const cylinder = new THREE.Mesh(geometry, skinMaterial);

            // Position and orient cylinder
            cylinder.position.copy(center);

            // Orient cylinder to connect the two points
            const quaternion = new THREE.Quaternion();
            const up = new THREE.Vector3(0, 1, 0);
            quaternion.setFromUnitVectors(up, direction.normalize());
            cylinder.setRotationFromQuaternion(quaternion);

            this.handAvatarGroup.add(cylinder);
            this.fingerSegments.push(cylinder);
        });

        // Create spheres at joints
        const jointIndices = [
            0, 1, 2, 3, 4,       // Thumb
            5, 6, 7, 8,          // Index
            9, 10, 11, 12,       // Middle
            13, 14, 15, 16,      // Ring
            17, 18, 19, 20       // Pinky
        ];

        jointIndices.forEach(idx => {
            let jointRadius;
            if (idx === 0) {
                jointRadius = this.landmarkSize * 3; // Wrist/palm base
            } else if ([4, 8, 12, 16, 20].includes(idx)) {
                jointRadius = this.landmarkSize * 1.5; // Fingertips
            } else {
                jointRadius = this.landmarkSize * 2; // Joints
            }

            const geometry = new THREE.SphereGeometry(jointRadius, 16, 16);
            const sphere = new THREE.Mesh(geometry, jointMaterial);
            sphere.position.copy(positions[idx]);

            this.handAvatarGroup.add(sphere);
            this.jointSpheres.push(sphere);
        });

        // Create palm mesh (connecting palm landmarks)
        const palmIndices = [0, 5, 9, 13, 17];
        const palmPositions = palmIndices.map(idx => positions[idx]);

        // Create a convex shape for palm
        const palmGeometry = new THREE.BufferGeometry();
        const palmVertices = [];

        // Add palm vertices
        palmPositions.forEach(pos => {
            palmVertices.push(pos.x, pos.y, pos.z);
        });

        // Create triangles for palm
        const palmFaces = [
            0, 1, 2,
            0, 2, 3,
            0, 3, 4
        ];

        palmGeometry.setAttribute('position', new THREE.Float32BufferAttribute(palmVertices, 3));
        palmGeometry.setIndex(palmFaces);
        palmGeometry.computeVertexNormals();

        const palmMesh = new THREE.Mesh(palmGeometry, skinMaterial);
        this.handAvatarGroup.add(palmMesh);
        this.fingerSegments.push(palmMesh);

        this.scene.add(this.handAvatarGroup);
    }

    clearHand3D() {
        if (this.handSkeletonGroup) {
            this.landmarkMeshes.forEach(mesh => {
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            });
            this.connectionLines.forEach(line => {
                if (line.geometry) line.geometry.dispose();
                if (line.material) line.material.dispose();
            });
            this.scene.remove(this.handSkeletonGroup);
            this.handSkeletonGroup = null;
            this.landmarkMeshes = [];
            this.connectionLines = [];
        }

        // Clear avatar
        if (this.handAvatarGroup) {
            this.fingerSegments.forEach(seg => {
                if (seg.geometry) seg.geometry.dispose();
                if (seg.material) seg.material.dispose();
            });
            this.jointSpheres.forEach(sphere => {
                if (sphere.geometry) sphere.geometry.dispose();
                if (sphere.material) sphere.material.dispose();
            });
            this.scene.remove(this.handAvatarGroup);
            this.handAvatarGroup = null;
            this.fingerSegments = [];
            this.jointSpheres = [];
        }
    }

    setupControls() {
        // Start button
        const startBtn = document.getElementById('start3DBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startCamera());
        }

        // Stop button
        const stopBtn = document.getElementById('stop3DBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopCamera());
        }

        // Avatar toggle
        const avatarToggle = document.getElementById('avatarToggle3D');
        if (avatarToggle) {
            avatarToggle.addEventListener('change', (e) => {
                this.showAvatar = e.target.checked;
                if (this.currentLandmarks) {
                    this.updateHand3D(this.currentLandmarks);
                }
            });
        }

        // Auto rotate toggle
        const autoRotateToggle = document.getElementById('autoRotate3D');
        if (autoRotateToggle) {
            autoRotateToggle.addEventListener('change', (e) => {
                this.autoRotate = e.target.checked;
            });
        }

        // Grid toggle
        const gridToggle = document.getElementById('gridToggle3D');
        if (gridToggle) {
            gridToggle.addEventListener('change', (e) => {
                this.showGrid = e.target.checked;
                this.grid.visible = this.showGrid;
                this.axisHelper.visible = this.showGrid;
            });
        }

        // Reset camera button
        const resetCameraBtn = document.getElementById('resetCamera3DBtn');
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                this.camera3D.position.set(0, 0, 5);
                this.camera3D.lookAt(0, 0, 0);
            });
        }

        // Landmark color
        const landmarkColorSelect = document.getElementById('landmarkColorSelect');
        if (landmarkColorSelect) {
            landmarkColorSelect.addEventListener('change', (e) => {
                this.landmarkColor = parseInt(e.target.value);
                if (this.currentLandmarks) {
                    this.updateHand3D(this.currentLandmarks);
                }
            });
        }

        // Connection color
        const connectionColorSelect = document.getElementById('connectionColorSelect');
        if (connectionColorSelect) {
            connectionColorSelect.addEventListener('change', (e) => {
                this.connectionColor = parseInt(e.target.value);
                if (this.currentLandmarks) {
                    this.updateHand3D(this.currentLandmarks);
                }
            });
        }

        // Background color
        const backgroundColorSelect = document.getElementById('backgroundColorSelect3D');
        if (backgroundColorSelect) {
            backgroundColorSelect.addEventListener('change', (e) => {
                const color = parseInt(e.target.value);
                this.scene.background.setHex(color);
            });
        }

        // Landmark size slider
        const landmarkSizeSlider = document.getElementById('landmarkSizeSlider');
        const landmarkSizeValue = document.getElementById('landmarkSizeValue');
        if (landmarkSizeSlider) {
            landmarkSizeSlider.addEventListener('input', (e) => {
                this.landmarkSize = parseFloat(e.target.value);
                if (landmarkSizeValue) {
                    landmarkSizeValue.textContent = this.landmarkSize.toFixed(2);
                }
                if (this.currentLandmarks) {
                    this.updateHand3D(this.currentLandmarks);
                }
            });
        }

        // Scale slider
        const scaleSlider = document.getElementById('scaleSlider');
        const scaleValue = document.getElementById('scaleValue');
        if (scaleSlider) {
            scaleSlider.addEventListener('input', (e) => {
                this.scale3D = parseFloat(e.target.value);
                if (scaleValue) {
                    scaleValue.textContent = this.scale3D.toFixed(1);
                }
                if (this.currentLandmarks) {
                    this.updateHand3D(this.currentLandmarks);
                }
            });
        }
    }

    setupMouseControls() {
        const canvas = this.renderer.domElement;
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                const rotationSpeed = 0.005;
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera3D.position);

                spherical.theta -= deltaX * rotationSpeed;
                spherical.phi -= deltaY * rotationSpeed;

                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                this.camera3D.position.setFromSpherical(spherical);
                this.camera3D.lookAt(0, 0, 0);

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const direction = e.deltaY > 0 ? 1 : -1;

            const distance = this.camera3D.position.length();
            const newDistance = distance + direction * zoomSpeed;

            if (newDistance > 2 && newDistance < 20) {
                this.camera3D.position.multiplyScalar(newDistance / distance);
            }
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Update FPS
        const currentTime = performance.now();
        this.frameCount++;
        if (currentTime >= this.lastTime + 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;

            const fpsElement = document.getElementById('viewer3dFPS');
            if (fpsElement) {
                fpsElement.textContent = this.fps;
            }
        }

        // Auto rotate
        if (this.autoRotate) {
            if (this.handSkeletonGroup) {
                this.handSkeletonGroup.rotation.y += 0.01;
            }
            if (this.handAvatarGroup) {
                this.handAvatarGroup.rotation.y += 0.01;
            }
        }

        // Update camera position display
        const posElement = document.getElementById('cameraPosition3D');
        if (posElement) {
            const pos = this.camera3D.position;
            posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        }

        // Render
        this.renderer.render(this.scene, this.camera3D);
    }

    updateStatus(text, isActive) {
        const statusText = document.getElementById('statusText3D');
        const statusBadge = document.getElementById('statusBadge3D');

        if (statusText) {
            statusText.textContent = text;
        }

        if (statusBadge) {
            if (isActive) {
                statusBadge.classList.add('active');
            } else {
                statusBadge.classList.remove('active');
            }
        }
    }

    updateHandDetection(detected, count = 0) {
        const badge = document.getElementById('handDetectionBadge3D');
        const text = document.getElementById('handDetectionText3D');
        const handsDetected = document.getElementById('handsDetected3D');

        if (badge && text) {
            if (detected) {
                badge.classList.add('detected');
                text.textContent = `손 감지됨 (${count})`;
            } else {
                badge.classList.remove('detected');
                text.textContent = '손 감지 대기';
            }
        }

        if (handsDetected) {
            handsDetected.textContent = count;
        }
    }

    onWindowResize() {
        const canvas = this.renderer.domElement;
        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera3D.aspect = width / height;
        this.camera3D.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    destroy() {
        this.stopCamera();

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        this.clearHand3D();

        if (this.renderer) {
            this.renderer.dispose();
        }

        console.log('3D Hand Viewer destroyed');
    }
}

// Global instance
let handViewer3DInstance = null;

// Initialize when tab is shown
document.addEventListener('DOMContentLoaded', () => {
    const viewer3dTab = document.querySelector('[data-tab="viewer3d"]');
    if (viewer3dTab) {
        viewer3dTab.addEventListener('click', async () => {
            setTimeout(async () => {
                if (!handViewer3DInstance) {
                    handViewer3DInstance = new HandViewer3D();
                    await handViewer3DInstance.init();
                }
            }, 100);
        });
    }
});
