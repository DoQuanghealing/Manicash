export const VI = {
  nav: {
    dashboard: "Tổng quan",
    budgets: "Ngân sách",
    goals: "Mục tiêu",
    insights: "Thu nhập",
  },
  dashboard: {
    netWorth: "Tổng tài sản",
    availableBalance: "Số dư khả dụng",
    recentActivity: "Gần đây",
    viewAll: "Xem tất cả",
    noTransactions: "Chưa có giao dịch.",
    addWallet: "Thêm ví",
    settings: "Cài đặt",
    todaySummary: "Hôm nay",
    income: "Thu",
    expense: "Chi",
    viewMode: {
      list: "Danh sách",
      calendar: "Lịch"
    },
    comments: {
      good: "Tuyệt vời, bạn đang kiểm soát tốt! 🎉",
      warning: "Cẩn thận, chi nhiều hơn thu! 💸",
      neutral: "Chưa có giao dịch nào hôm nay. 💤",
      saver: "Hôm nay bạn rất tiết kiệm! 🌱"
    },
    tabs: {
      main: "Ví chính",
      backup: "Quỹ dự phòng"
    },
    encouragement: {
      title: "Tổng quan năng lực",
      btnMission: "Nhiệm vụ hôm nay",
      modalTitle: "Nhiệm vụ tài chính",
      status: {
        great: "Tài chính khỏe mạnh! 🚀",
        good: "Đang đi đúng hướng 👍",
        warning: "Cần thắt chặt chi tiêu ⚠️",
        danger: "Báo động đỏ! 🚨"
      },
      missions: {
        empty: "Tuyệt vời, hôm nay không có áp lực tài chính nào!",
        projectPrefix: "Còn",
        projectSuffix: "buổi nữa trong",
        projectEarn: "để thu về",
        costNeeded: "Cần tích lũy thêm",
        for: "cho",
        deadline: "Hạn chót:"
      }
    },
    backup: {
      configTitle: "Cấu hình trích lập",
      autoLabel: "Tự động trích từ thu nhập",
      on: "Đang bật",
      off: "Đã tắt",
      desc: "Khi có thu nhập vào Ví chính, hệ thống sẽ tự động trích % vào quỹ này."
    }
  },
  settings: {
    title: "Cài đặt chung",
    editNames: "Hồ sơ cá nhân",
    user1: "Tên hiển thị",
    user2: "Người thứ 2", // Legacy, not used in UI
    save: "Lưu cấu hình",
    cancel: "Hủy",
    autoDeduct: {
        title: "Tự động trích quỹ",
        description: "Khi có thu nhập vào Ví chính, tự động chuyển một phần sang Quỹ dự phòng."
    }
  },
  budget: {
    title: "Quản lý Ngân sách",
    tabs: {
        flexible: "Hạn mức chi tiêu",
        fixed: "Chi phí cố định"
    },
    strictMode: "Chế độ nghiêm ngặt",
    limitExceeded: "Đã vượt hạn mức",
    warning: "Sắp hết hạn mức",
    limit: "Hạn mức",
    edit: "Cài đặt ngân sách",
    save: "Lưu cấu hình",
    cancel: "Hủy bỏ",
    addBudget: "Thêm mục theo dõi",
    placeholderLimit: "Nhập số tiền...",
    remove: "Xóa",
    selectCategory: "Chọn danh mục",
    availableCategories: "Danh mục khả dụng",
    allocation: {
      btn: "Phân bổ",
      title: "Phân bổ dòng tiền tự động",
      inputLabel: "Số tiền nhận vào (Lương/Thưởng)",
      subtitle: "Tự động chia tiền vào các quỹ theo %",
      tableHeader: "Danh mục phân bổ",
      confirm: "Thực hiện phân bổ",
      result: "Đã phân bổ thành công!",
      error: "Vui lòng nhập số tiền hợp lệ",
      noSource: "Vui lòng chọn ví nguồn"
    },
    fixed: {
        title: "Hóa đơn & Định kỳ",
        addBtn: "Thêm hóa đơn",
        name: "Tên hóa đơn",
        amount: "Số tiền dự kiến",
        nextDue: "Ngày đến hạn tiếp theo",
        cycle: "Chu kỳ (tháng)",
        payBtn: "Thanh toán",
        daysLeft: "ngày nữa",
        overdue: "Quá hạn",
        today: "Hôm nay",
        paidConfirm: "Thanh toán hóa đơn này và dời lịch sang kỳ tiếp theo?",
        empty: "Chưa có hóa đơn cố định nào.",
        saved: "Đã dành"
    }
  },
  transaction: {
    title: "Giao dịch mới",
    save: "Tiếp tục",
    amount: "Số tiền",
    category: "Danh mục",
    wallet: "Ví nguồn",
    description: "Mô tả",
    placeholderAmount: "0",
    placeholderDesc: "Chi tiết giao dịch...",
    addCategory: "+ Thêm danh mục...",
    newCategoryTitle: "Tạo danh mục mới",
    categoryName: "Tên danh mục",
    cancel: "Hủy",
    create: "Tạo",
    types: {
      INCOME: "Thu nhập",
      EXPENSE: "Chi tiêu",
      TRANSFER: "Chuyển khoản",
    },
    confirmation: {
      title: "Xác nhận thông tin",
      message: "Vui lòng kiểm tra kỹ số tiền.",
      checkAmount: "Số tiền giao dịch",
      checkDetail: "Chi tiết",
      confirmBtn: "Đã đúng, Lưu lại",
      backBtn: "Quay lại sửa"
    }
  },
  goals: {
    title: "Mục tiêu tài chính",
    newGoal: "Tạo mục tiêu mới",
    target: "Mục tiêu",
    current: "Hiện có",
    funded: "Đã đạt",
    rounds: "Lịch sử nạp",
    addRound: "Nạp tiền",
    noGoals: "Chưa có mục tiêu nào. Hãy tạo mới!",
    by: "Hạn chót",
    daysLeft: "ngày còn lại",
    createTitle: "Mục tiêu mới",
    nameLabel: "Tên dự án / Mục tiêu",
    targetLabel: "Số tiền cần (VND)",
    deadlineLabel: "Ngày hoàn thành",
    depositTitle: "Nạp tiền vào mục tiêu",
    sourceWallet: "Lấy từ ví",
    depositAmount: "Số tiền nạp",
    note: "Ghi chú",
    confirmDeposit: "Xác nhận nạp",
    saveGoal: "Lưu mục tiêu"
  },
  insights: {
    title: "Thu nhập & Báo cáo",
    tabs: {
      planning: "Kế hoạch Thu nhập",
      report: "Báo cáo & Phân tích"
    },
    report: {
      btnGenerate: "Phân tích ngay",
      generating: "Đang đánh giá...",
      healthScore: "Điểm năng lực tài chính",
      incomeTrend: "Xu hướng thu nhập",
      projectVelocity: "Tốc độ dự án",
      goalForecast: "Dự báo lộ trình",
      fixedCostStatus: "Khả năng thanh toán hóa đơn",
      advice: "Lời khuyên chiến lược"
    },
    createBtn: "Tạo kế hoạch mới",
    noProjects: "Chưa có kế hoạch gia tăng thu nhập nào.",
    aiSuggestBtn: "Hỏi AI kế hoạch",
    project: {
      name: "Tên dự án / Công việc",
      desc: "Mô tả ngắn",
      expected: "Doanh thu kỳ vọng",
      timeline: "Thời gian thực hiện",
      start: "Bắt đầu",
      end: "Kết thúc",
      milestones: "Nhiệm vụ & Tiến độ",
      addMilestone: "Thêm đầu việc",
      complete: "Hoàn tất dự án",
      collect: "Thu tiền về ví",
      placeholderName: "VD: Coaching chị Phượng",
      placeholderMilestone: "VD: Buổi 1 - Khám phá",
      status: {
        planning: "Lên kế hoạch",
        in_progress: "Đang thực hiện",
        completed: "Hoàn thành"
      }
    },
    aiModal: {
      title: "Gợi ý kế hoạch từ AI",
      inputLabel: "Bạn muốn kiếm tiền từ việc gì?",
      inputPlaceholder: "VD: Bán hàng online, Dạy tiếng Anh...",
      generate: "Lập kế hoạch chi tiết",
      generating: "Đang suy nghĩ...",
      useThis: "Sử dụng kế hoạch này"
    }
  },
  reflection: {
    title: "Khoảnh khắc phản tư",
    defaultTitle: "Cảnh báo ngân sách",
    exceeded: "Bạn đã vượt hạn mức cho",
    guilt: "Tôi hiểu rồi",
    yolo: "Bỏ qua",
    received: "Đã hiểu",
  },
  category: {
    'Food & Dining': 'Ăn uống',
    'Transport': 'Di chuyển',
    'Shopping': 'Mua sắm',
    'Bills & Utilities': 'Hóa đơn',
    'Entertainment': 'Giải trí',
    'Investment': 'Đầu tư',
    'Income': 'Thu nhập',
    'Transfer': 'Chuyển khoản',
    'Other': 'Khác',
  }
};