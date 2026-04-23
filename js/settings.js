/**
 * Portal Karyawan - Settings
 * Admin settings functionality
 */

const settings = {
    shifts: [],

    async init() {
        // Check if admin
        if (!auth.isAdmin()) {
            toast.error('Anda tidak memiliki akses ke halaman ini!');
            router.navigate('dashboard');
            return;
        }

        await this.loadSettings();
        this.initForms();
        this.renderShifts();
    },

    async loadSettings() {
        try {
            const [settingsResult, shiftsResult] = await Promise.all([
                api.getSettings(),
                api.getShifts()
            ]);

            // Fix shift times - Google Sheets converts "08:00" to Date objects
            this.shifts = (shiftsResult.data || []).map(shift => ({
                ...shift,
                startTime: dateTime.normalizeTime(shift.startTime),
                endTime: dateTime.normalizeTime(shift.endTime)
            }));

            const allSettings = settingsResult.data || {};

            // Company info
            const companyName = document.getElementById('company-name');
            const companyLogo = document.getElementById('company-logo');
            if (companyName) companyName.value = allSettings.company_name || '';
            if (companyLogo) companyLogo.value = allSettings.company_logo || '';

            // Working days
            const workdays = allSettings.working_days ? JSON.parse(allSettings.working_days) : null;
            if (workdays) {
                const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
                days.forEach(day => {
                    const el = document.getElementById(`day-${day}`);
                    if (el) el.checked = workdays[day] !== false;
                });
            }

            // System settings
            if (allSettings.late_tolerance !== undefined) {
                const el = document.getElementById('setting-late-tolerance');
                if (el) el.value = allSettings.late_tolerance;
            }
            if (allSettings.face_recognition !== undefined) {
                const el = document.getElementById('setting-face-recognition');
                if (el) el.checked = allSettings.face_recognition === 'true' || allSettings.face_recognition === true;
            }
            if (allSettings.location_tracking !== undefined) {
                const el = document.getElementById('setting-location-tracking');
                if (el) el.checked = allSettings.location_tracking === 'true' || allSettings.location_tracking === true;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.shifts = storage.get('shifts', []);
            const company = storage.get('company', { name: '', logo: '' });
            const companyName = document.getElementById('company-name');
            const companyLogo = document.getElementById('company-logo');
            if (companyName) companyName.value = company.name;
            if (companyLogo) companyLogo.value = company.logo;
        }
    },


    initForms() {
        // Company form
        const companyForm = document.getElementById('company-form');
        if (companyForm) {
            companyForm.addEventListener('submit', (e) => this.saveCompany(e));
        }

        // Add shift button
        const addShiftBtn = document.getElementById('btn-add-shift');
        if (addShiftBtn) {
            addShiftBtn.addEventListener('click', () => this.addShift());
        }

        // Save working days
        const saveWorkdaysBtn = document.getElementById('btn-save-workdays');
        if (saveWorkdaysBtn) {
            saveWorkdaysBtn.addEventListener('click', () => this.saveWorkdays());
        }

        // Save system settings
        const saveSystemBtn = document.getElementById('btn-save-system');
        if (saveSystemBtn) {
            saveSystemBtn.addEventListener('click', () => this.saveSystemSettings());
        }
    },

    async saveCompany(e) {
        e.preventDefault();

        const name = document.getElementById('company-name').value;
        const logo = document.getElementById('company-logo').value;

        try {
            await Promise.all([
                api.saveSetting('company_name', name),
                api.saveSetting('company_logo', logo)
            ]);
            // Also update localStorage for immediate UI update
            storage.set('company', { name, logo });
            updateCompanyUI();
            toast.success('Informasi perusahaan berhasil disimpan!');
        } catch (error) {
            console.error('Error saving company:', error);
            toast.error('Gagal menyimpan');
        }
    },

    async saveWorkdays() {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
        const workdays = {};
        days.forEach(day => {
            const el = document.getElementById(`day-${day}`);
            workdays[day] = el ? el.checked : false;
        });

        try {
            await api.saveSetting('working_days', JSON.stringify(workdays));
            toast.success('Hari kerja berhasil disimpan!');
        } catch (error) {
            console.error('Error saving workdays:', error);
            toast.error('Gagal menyimpan hari kerja');
        }
    },

    async saveSystemSettings() {
        const lateTolerance = document.getElementById('setting-late-tolerance');
        const faceRecognition = document.getElementById('setting-face-recognition');
        const locationTracking = document.getElementById('setting-location-tracking');

        try {
            await Promise.all([
                api.saveSetting('late_tolerance', lateTolerance ? lateTolerance.value : '15'),
                api.saveSetting('face_recognition', faceRecognition ? String(faceRecognition.checked) : 'true'),
                api.saveSetting('location_tracking', locationTracking ? String(locationTracking.checked) : 'true')
            ]);
            toast.success('Pengaturan sistem berhasil disimpan!');
        } catch (error) {
            console.error('Error saving system settings:', error);
            toast.error('Gagal menyimpan pengaturan sistem');
        }
    },

    renderShifts() {
        const container = document.getElementById('shifts-list');
        if (!container) return;

        if (this.shifts.length === 0) {
            container.innerHTML = '<p class="empty-state">Belum ada shift</p>';
            return;
        }

        container.innerHTML = this.shifts.map((shift, index) => `
            <div class="shift-item" id="shift-item-${index}" data-index="${index}">
                <div class="shift-input-group">
                    <label>Nama Shift</label>
                    <input type="text" value="${shift.name}" placeholder="Nama Shift" 
                           onchange="settings.updateShift(${index}, 'name', this.value)">
                </div>
                <div class="shift-input-group">
                    <label>Jam Masuk</label>
                    <input type="time" value="${shift.startTime}" 
                           onchange="settings.updateShift(${index}, 'startTime', this.value)">
                </div>
                <div class="shift-input-group">
                    <label>Jam Pulang</label>
                    <input type="time" value="${shift.endTime}" 
                           onchange="settings.updateShift(${index}, 'endTime', this.value)">
                </div>
                <div class="shift-actions">
                    <div class="shift-status" id="shift-status-${index}"></div>
                    <button type="button" class="btn-delete-shift" onclick="settings.deleteShift(${index})" title="Hapus Shift">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    async addShift() {
        const btn = document.getElementById('btn-add-shift');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Menambah...</span>';
        }

        const newShift = {
            name: 'Shift Baru',
            startTime: '09:00',
            endTime: '18:00'
        };

        try {
            const result = await api.addShift(newShift);
            if (result.success) {
                // Use result.data if available, otherwise use newShift with generated ID
                const addedShift = result.data || { ...newShift, id: result.id || Date.now() };
                this.shifts.push(addedShift);
                this.renderShifts();
                toast.success('Shift baru ditambahkan!');
            } else {
                toast.error(result.error || 'Gagal menambah shift');
            }
        } catch (error) {
            console.error('Error adding shift:', error);
            toast.error('Terjadi kesalahan jaringan');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-plus"></i><span>Tambah Shift</span>';
            }
        }
    },

    async updateShift(index, field, value) {
        if (this.shifts[index]) {
            const oldValue = this.shifts[index][field];
            
            // Normalize time if needed
            let newValue = value;
            if (field === 'startTime' || field === 'endTime') {
                newValue = dateTime.normalizeTime(value);
            }
            
            this.shifts[index][field] = newValue;

            const statusEl = document.getElementById(`shift-status-${index}`);
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                // CRITICAL: Send entire shift object because some backends (like simple GAS scripts)
                // might overwrite the entire row with the provided data.
                const shiftData = { ...this.shifts[index] };
                const result = await api.updateShift(shiftData.id, shiftData);
                
                if (result.success) {
                    if (statusEl) {
                        statusEl.innerHTML = '<i class="fas fa-check-circle" style="color: var(--color-success)"></i>';
                        setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 2000);
                    }
                } else {
                    this.shifts[index][field] = oldValue;
                    this.renderShifts();
                    toast.error(result.error || 'Gagal memperbarui shift');
                }
            } catch (error) {
                console.error('Error updating shift:', error);
                this.shifts[index][field] = oldValue;
                this.renderShifts();
                if (statusEl) statusEl.innerHTML = '<i class="fas fa-exclamation-circle" style="color: var(--color-danger)"></i>';
                toast.error('Terjadi kesalahan jaringan');
            }
        }
    },

    async deleteShift(index) {
        if (confirm('Apakah Anda yakin ingin menghapus shift ini?')) {
            try {
                const shiftId = this.shifts[index].id;
                await api.deleteShift(shiftId);
                this.shifts.splice(index, 1);
                this.renderShifts();
                toast.info('Shift dihapus');
            } catch (error) {
                console.error('Error deleting shift:', error);
            }
        }
    },

    getShiftOptions() {
        return this.shifts.map(shift => ({
            value: shift.name,
            label: `${shift.name} (${shift.startTime} - ${shift.endTime})`
        }));
    }
};

// Global init function
window.initSettings = () => {
    settings.init();
};

// Expose settings object
window.settings = settings;
