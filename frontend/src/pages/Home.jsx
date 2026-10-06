import { useEffect, useMemo, useState } from "react";
import "./Home.css";

function Home({ onLogin, onRegister }) {
  const [activeScene, setActiveScene] = useState(0);
  const [activeRole, setActiveRole] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [robotBlink, setRobotBlink] = useState(false);
  const [robotTalking, setRobotTalking] = useState(false);

  /*
   * ============================================================
   * HERO PRESENTATION SCENES
   * ============================================================
   */

  const presentationScenes = useMemo(
    () => [
      {
        id: "welcome",
        type: "welcome",
        eyebrow: "WELCOME TO FRESHGUARD",
        title: "Namaste! 👋",
        subtitle:
          "Main aapko Food Freshness Monitoring Platform ke baare mein batane aaya hoon.",
        icon: "🤖",
        accent: "AI FOOD ASSISTANT",
      },
      {
        id: "importance",
        type: "importance",
        eyebrow: "WHY FRESHGUARD?",
        title: "Food freshness matters.",
        subtitle:
          "Freshness ko samajhna, food waste kam karna aur food ko safely manage karna ab smarter ho sakta hai.",
        icon: "🌱",
        accent: "SMART FOOD MANAGEMENT",
      },
      {
        id: "add-food",
        type: "feature",
        eyebrow: "STEP 01",
        title: "Add Your Food",
        subtitle:
          "Food item add kijiye aur uski important information jaise image, dates aur storage condition provide kijiye.",
        icon: "🍎",
        accent: "FOOD INVENTORY",
      },
      {
        id: "ai-analysis",
        type: "feature",
        eyebrow: "STEP 02",
        title: "AI Freshness Analysis",
        subtitle:
          "AI aur Computer Vision food ki visual condition ko analyze karke freshness intelligence provide karte hain.",
        icon: "🧠",
        accent: "AI + COMPUTER VISION",
      },
      {
        id: "report",
        type: "feature",
        eyebrow: "STEP 03",
        title: "Get Your Freshness Report",
        subtitle:
          "Food ki freshness condition, score aur analysis ko easy-to-understand report mein dekhiye.",
        icon: "📊",
        accent: "FRESHNESS REPORT",
      },
      {
        id: "shelf-life",
        type: "feature",
        eyebrow: "STEP 04",
        title: "Shelf-Life Intelligence",
        subtitle:
          "Food ki remaining usability ko samajhne aur timely action lene mein intelligent shelf-life information help karti hai.",
        icon: "⏳",
        accent: "SHELF-LIFE",
      },
      {
        id: "storage",
        type: "feature",
        eyebrow: "STEP 05",
        title: "Storage Intelligence",
        subtitle:
          "Food ko better condition mein maintain karne ke liye storage-related intelligence aur recommendations milti hain.",
        icon: "🧊",
        accent: "STORAGE INTELLIGENCE",
      },
      {
        id: "recommendation",
        type: "feature",
        eyebrow: "STEP 06",
        title: "Smart Recommendations",
        subtitle:
          "Analysis ke basis par food management aur storage ke liye useful recommendations milti hain.",
        icon: "💡",
        accent: "SMART RECOMMENDATIONS",
      },
      {
        id: "roles",
        type: "roles",
        eyebrow: "ONE PLATFORM • MULTIPLE ROLES",
        title: "Every role gets the right intelligence.",
        subtitle:
          "Consumer se lekar Administrator tak, har role ke liye dedicated dashboard experience.",
        icon: "👥",
        accent: "ROLE-BASED PLATFORM",
      },
      {
        id: "ending",
        type: "ending",
        eyebrow: "READY TO GET STARTED?",
        title: "Make food management smarter.",
        subtitle:
          "Login kijiye ya account create karke FreshGuard ki smart food intelligence explore kijiye.",
        icon: "🚀",
        accent: "FRESHGUARD",
      },
    ],
    []
  );

  /*
   * ============================================================
   * ROLE DATA
   * ============================================================
   */

  const roleFeatures = useMemo(
    () => [
      {
        key: "consumer",
        name: "Consumer",
        shortName: "Consumer",
        icon: "👤",
        colorClass: "role-consumer",
        description:
          "Apne food inventory ko monitor kijiye aur freshness, shelf-life aur storage intelligence ko easily samajhiye.",
        features: [
          {
            icon: "🍎",
            title: "Food Inventory",
            text: "Apne added food items ko manage aur monitor kijiye.",
          },
          {
            icon: "🔍",
            title: "Freshness Reports",
            text: "Food ki freshness condition aur analysis dekhiye.",
          },
          {
            icon: "⏳",
            title: "Shelf-Life Estimates",
            text: "Food ki usable life ko better understand kijiye.",
          },
          {
            icon: "🧊",
            title: "Storage Recommendations",
            text: "Food ke liye suitable storage intelligence dekhiye.",
          },
        ],
      },
      {
        key: "retail",
        name: "Retail Manager",
        shortName: "Retail",
        icon: "🏪",
        colorClass: "role-retail",
        description:
          "Retail inventory ki quality, freshness aur shelf-life ko smarter way mein monitor kijiye.",
        features: [
          {
            icon: "📦",
            title: "Inventory Quality",
            text: "Inventory ki overall freshness health monitor kijiye.",
          },
          {
            icon: "📊",
            title: "Freshness Analytics",
            text: "Products ki freshness trends aur analytics dekhiye.",
          },
          {
            icon: "⚠️",
            title: "Shelf-Life Alerts",
            text: "Near-expiry aur freshness concerns ko identify kijiye.",
          },
          {
            icon: "♻️",
            title: "Waste Reduction",
            text: "Food waste ko reduce karne ke liye insights use kijiye.",
          },
        ],
      },
      {
        key: "warehouse",
        name: "Warehouse Operator",
        shortName: "Warehouse",
        icon: "🏭",
        colorClass: "role-warehouse",
        description:
          "Warehouse mein storage conditions aur batch-level freshness ko intelligently monitor kijiye.",
        features: [
          {
            icon: "🧊",
            title: "Storage Compliance",
            text: "Storage conditions ko monitor aur maintain kijiye.",
          },
          {
            icon: "📦",
            title: "Batch Freshness",
            text: "Different food batches ki freshness track kijiye.",
          },
          {
            icon: "❤️",
            title: "Inventory Health",
            text: "Warehouse inventory ki freshness health samajhiye.",
          },
          {
            icon: "🌡️",
            title: "Environmental Analytics",
            text: "Storage environment se related intelligence dekhiye.",
          },
        ],
      },
      {
        key: "inspector",
        name: "Food Quality Inspector",
        shortName: "Inspector",
        icon: "🔬",
        colorClass: "role-inspector",
        description:
          "Food quality inspection ke liye AI analysis aur freshness intelligence ka use kijiye.",
        features: [
          {
            icon: "🔍",
            title: "Food Quality",
            text: "Food condition ko systematically inspect kijiye.",
          },
          {
            icon: "🧠",
            title: "AI Analysis",
            text: "Computer Vision based freshness intelligence dekhiye.",
          },
          {
            icon: "🚨",
            title: "Spoilage Detection",
            text: "Possible spoilage indicators ko identify kijiye.",
          },
          {
            icon: "📄",
            title: "Quality Reports",
            text: "Food quality information ko report format mein dekhiye.",
          },
        ],
      },
      {
        key: "administrator",
        name: "Administrator",
        shortName: "Admin",
        icon: "⚙️",
        colorClass: "role-administrator",
        description:
          "Complete platform ko manage kijiye aur users, analytics aur reporting ko monitor kijiye.",
        features: [
          {
            icon: "👥",
            title: "User Management",
            text: "Platform users aur roles ko manage kijiye.",
          },
          {
            icon: "📊",
            title: "Platform Analytics",
            text: "Complete platform-level analytics dekhiye.",
          },
          {
            icon: "🖥️",
            title: "System Monitoring",
            text: "Platform activity aur system status monitor kijiye.",
          },
          {
            icon: "📑",
            title: "Report Management",
            text: "Platform reports aur reporting information manage kijiye.",
          },
        ],
      },
    ],
    []
  );

  /*
   * ============================================================
   * PLATFORM FEATURES
   * ============================================================
   */

  const platformFeatures = useMemo(
    () => [
      {
        icon: "🧠",
        title: "AI Freshness Detection",
        text: "AI-powered intelligence food freshness ko understand karne mein help karti hai.",
      },
      {
        icon: "👁️",
        title: "Computer Vision",
        text: "Food image ke visual characteristics ko analyze karke intelligent insights provide kiye jaate hain.",
      },
      {
        icon: "📊",
        title: "Freshness Scoring",
        text: "Food ki condition ko easy-to-understand freshness information ke form mein dekhiye.",
      },
      {
        icon: "⏳",
        title: "Shelf-Life Intelligence",
        text: "Food ki remaining usability aur timely action ko better understand kijiye.",
      },
      {
        icon: "🧊",
        title: "Storage Intelligence",
        text: "Better food management ke liye storage-related intelligence aur recommendations.",
      },
      {
        icon: "🚨",
        title: "Spoilage Detection",
        text: "Potential spoilage indicators ko identify karne mein AI analysis support karta hai.",
      },
      {
        icon: "💡",
        title: "Smart Recommendations",
        text: "Food handling aur storage ke liye useful recommendations.",
      },
      {
        icon: "👥",
        title: "Role-Based Dashboards",
        text: "Different users ke liye dedicated dashboard experience.",
      },
      {
        icon: "📄",
        title: "Reports & Analytics",
        text: "Food freshness aur platform intelligence ko reports aur analytics ke through samajhiye.",
      },
    ],
    []
  );

  /*
   * ============================================================
   * EFFECTS
   * ============================================================
   */

  useEffect(() => {
    setIsVisible(true);

    const sceneTimer = setInterval(() => {
      setActiveScene((current) => {
        const next = current + 1;

        if (next >= presentationScenes.length) {
          return 0;
        }

        return next;
      });
    }, 6500);

    return () => clearInterval(sceneTimer);
  }, [presentationScenes.length]);

  useEffect(() => {
    const blinkTimer = setInterval(() => {
      setRobotBlink(true);

      setTimeout(() => {
        setRobotBlink(false);
      }, 180);
    }, 3200);

    return () => clearInterval(blinkTimer);
  }, []);

  useEffect(() => {
    const talkingTimer = setInterval(() => {
      setRobotTalking(true);

      setTimeout(() => {
        setRobotTalking(false);
      }, 2200);
    }, 6500);

    return () => clearInterval(talkingTimer);
  }, []);

  useEffect(() => {
    const currentScene = presentationScenes[activeScene];

    if (currentScene?.type === "roles") {
      const roleTimer = setInterval(() => {
        setActiveRole((current) => (current + 1) % roleFeatures.length);
      }, 2500);

      return () => clearInterval(roleTimer);
    }
  }, [activeScene, presentationScenes, roleFeatures.length]);

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  const goToLogin = () => {
    if (typeof onLogin === "function") {
      onLogin();
    }
  };

  const goToRegister = () => {
    if (typeof onRegister === "function") {
      onRegister();
    }
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const selectScene = (index) => {
    setActiveScene(index);
  };

  const nextScene = () => {
    setActiveScene(
      (current) => (current + 1) % presentationScenes.length
    );
  };

  const previousScene = () => {
    setActiveScene(
      (current) =>
        (current - 1 + presentationScenes.length) %
        presentationScenes.length
    );
  };

  const currentScene = presentationScenes[activeScene];

  const activeRoleData = roleFeatures[activeRole];

  /*
   * ============================================================
   * ROBOT
   * ============================================================
   */

  const RobotTeacher = () => {
    const isWelcomeScene = currentScene?.type === "welcome";

    return (
      <div
        className={`ai-teacher-stage ${
          isWelcomeScene ? "robot-welcome-mode" : "robot-presenting-mode"
        }`}
      >
        <div className="ai-teacher-glow" />

        <div className="ai-teacher-particles">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="ai-robot">
          <div className="robot-antenna">
            <span className="robot-antenna-light" />
          </div>

          <div className="robot-head">
            <div className="robot-ear robot-ear-left" />
            <div className="robot-ear robot-ear-right" />

            <div className="robot-face">
              <div
                className={`robot-eye robot-eye-left ${
                  robotBlink ? "robot-eye-blink" : ""
                }`}
              />

              <div
                className={`robot-eye robot-eye-right ${
                  robotBlink ? "robot-eye-blink" : ""
                }`}
              />

              <div
                className={`robot-mouth ${
                  robotTalking ? "robot-mouth-talking" : ""
                }`}
              />
            </div>
          </div>

          <div className="robot-neck" />

          <div className="robot-body">
            <div className="robot-chest">
              <div className="robot-chest-logo">FG</div>

              <div className="robot-chest-lines">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="robot-arm robot-arm-left">
              <div className="robot-upper-arm" />
              <div className="robot-forearm" />
              <div className="robot-hand">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="robot-arm robot-arm-right">
              <div className="robot-upper-arm" />
              <div className="robot-forearm" />
              <div className="robot-hand">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="robot-base">
            <div className="robot-base-ring" />
            <div className="robot-base-light" />
          </div>
        </div>

        <div className="robot-floor-glow" />

        <div className="robot-status">
          <span className="robot-status-dot" />
          <span>
            {isWelcomeScene ? "AI Teacher Online" : "Explaining FreshGuard"}
          </span>
        </div>
      </div>
    );
  };

  /*
   * ============================================================
   * SCENE CONTENT
   * ============================================================
   */

  const renderSceneContent = () => {
    if (!currentScene) {
      return null;
    }

    if (currentScene.type === "roles") {
      return (
        <div className="presentation-scene-content roles-presentation">
          <div className="scene-heading">
            <span className="scene-eyebrow">{currentScene.eyebrow}</span>

            <h2>{currentScene.title}</h2>

            <p>{currentScene.subtitle}</p>
          </div>

          <div className="role-presentation-window">
            <div className="role-presentation-tabs">
              {roleFeatures.map((role, index) => (
                <button
                  key={role.key}
                  type="button"
                  className={`role-presentation-tab ${
                    activeRole === index ? "active" : ""
                  }`}
                  onClick={() => setActiveRole(index)}
                >
                  <span className="role-tab-icon">{role.icon}</span>
                  <span>{role.shortName}</span>
                </button>
              ))}
            </div>

            <div
              className={`role-presentation-content ${activeRoleData.colorClass}`}
              key={activeRoleData.key}
            >
              <div className="role-presentation-main">
                <div className="role-presentation-icon">
                  {activeRoleData.icon}
                </div>

                <div>
                  <span className="role-presentation-label">
                    ROLE DASHBOARD
                  </span>

                  <h3>{activeRoleData.name}</h3>

                  <p>{activeRoleData.description}</p>
                </div>
              </div>

              <div className="role-feature-grid">
                {activeRoleData.features.map((feature, index) => (
                  <div
                    className="role-feature-card"
                    key={`${activeRoleData.key}-${feature.title}`}
                    style={{
                      "--feature-index": index,
                    }}
                  >
                    <div className="role-feature-card-icon">
                      {feature.icon}
                    </div>

                    <div>
                      <h4>{feature.title}</h4>
                      <p>{feature.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentScene.type === "ending") {
      return (
        <div className="presentation-scene-content ending-presentation">
          <div className="ending-presentation-icon">{currentScene.icon}</div>

          <span className="scene-eyebrow">{currentScene.eyebrow}</span>

          <h2>{currentScene.title}</h2>

          <p>{currentScene.subtitle}</p>

          <div className="hero-action-buttons presentation-actions">
            <button
              type="button"
              className="primary-action-button"
              onClick={goToLogin}
            >
              <span>Login</span>
              <span className="button-arrow">→</span>
            </button>

            <button
              type="button"
              className="secondary-action-button"
              onClick={goToRegister}
            >
              <span>Create Account</span>
              <span className="button-arrow">→</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`presentation-scene-content ${
          currentScene.type === "welcome"
            ? "welcome-presentation"
            : "feature-presentation"
        }`}
        key={currentScene.id}
      >
        <div className="scene-heading">
          <span className="scene-eyebrow">{currentScene.eyebrow}</span>

          <h2>{currentScene.title}</h2>

          <p>{currentScene.subtitle}</p>
        </div>

        <div className="scene-feature-visual">
          <div className="scene-feature-icon-wrap">
            <div className="scene-feature-ring scene-ring-one" />
            <div className="scene-feature-ring scene-ring-two" />
            <div className="scene-feature-ring scene-ring-three" />

            <div className="scene-feature-icon">
              {currentScene.icon}
            </div>
          </div>

          <div className="scene-feature-info">
            <span>{currentScene.accent}</span>

            {currentScene.type === "welcome" ? (
              <div className="welcome-message-lines">
                <div className="welcome-message-line">
                  <span className="message-dot" />
                  <strong>Namaste</strong>
                  <span>🙏</span>
                </div>

                <div className="welcome-message-line">
                  <span className="message-dot" />
                  <strong>Hello</strong>
                  <span>👋</span>
                </div>

                <div className="welcome-message-line">
                  <span className="message-dot" />
                  <strong>Welcome to FreshGuard</strong>
                </div>
              </div>
            ) : (
              <div className="feature-animation-lines">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /*
   * ============================================================
   * RETURN
   * ============================================================
   */

  return (
    <main className={`home-page ${isVisible ? "home-page-visible" : ""}`}>
      {/* ========================================================
          NAVBAR
      ======================================================== */}

      <header className="home-navbar">
        <div className="home-navbar-inner">
          <button
            type="button"
            className="home-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <span className="home-brand-mark">
              <span>F</span>
              <span>G</span>
            </span>

            <span className="home-brand-text">
              <strong>FreshGuard</strong>
              <small>AI Food Intelligence</small>
            </span>
          </button>

          <nav className="home-navigation">
            <button
              type="button"
              onClick={() => scrollToSection("platform")}
            >
              Platform
            </button>

            <button
              type="button"
              onClick={() => scrollToSection("features")}
            >
              Features
            </button>

            <button
              type="button"
              onClick={() => scrollToSection("roles")}
            >
              Roles
            </button>

            <button
              type="button"
              onClick={() => scrollToSection("how-it-works")}
            >
              How It Works
            </button>
          </nav>

          <div className="home-navbar-actions">
            <button
              type="button"
              className="navbar-login-button"
              onClick={goToLogin}
            >
              Login
            </button>

            <button
              type="button"
              className="navbar-register-button"
              onClick={goToRegister}
            >
              Create Account
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          HERO / AI TEACHER PRESENTATION
      ======================================================== */}

      <section className="home-hero-presentation" id="home">
        <div className="hero-background-grid" />
        <div className="hero-background-glow hero-glow-one" />
        <div className="hero-background-glow hero-glow-two" />

        <div className="hero-floating-orb hero-orb-one" />
        <div className="hero-floating-orb hero-orb-two" />
        <div className="hero-floating-orb hero-orb-three" />

        <div className="hero-presentation-container">
          <div className="hero-top-label">
            <span className="live-dot" />
            <span>AI FOOD FRESHNESS MONITORING PLATFORM</span>
          </div>

          <div className="hero-presentation-grid">
            {/* ROBOT */}
            <div className="hero-robot-column">
              <RobotTeacher />

              <div className="robot-caption">
                <span className="robot-caption-line" />
                <span>AI FOOD TEACHER</span>
                <span className="robot-caption-line" />
              </div>
            </div>

            {/* PRESENTATION */}
            <div className="hero-presentation-column">
              <div className="presentation-glass-card">
                <div className="presentation-card-top">
                  <div className="presentation-card-status">
                    <span className="presentation-status-dot" />
                    <span>LIVE AI PRESENTATION</span>
                  </div>

                  <div className="presentation-step-counter">
                    <span>
                      {String(activeScene + 1).padStart(2, "0")}
                    </span>
                    <span className="counter-divider">/</span>
                    <span>
                      {String(presentationScenes.length).padStart(2, "0")}
                    </span>
                  </div>
                </div>

                <div className="presentation-card-content">
                  {renderSceneContent()}
                </div>

                <div className="presentation-controls">
                  <button
                    type="button"
                    className="presentation-control"
                    onClick={previousScene}
                    aria-label="Previous presentation"
                  >
                    ←
                  </button>

                  <div className="presentation-progress">
                    {presentationScenes.map((scene, index) => (
                      <button
                        key={scene.id}
                        type="button"
                        className={`presentation-progress-item ${
                          index === activeScene ? "active" : ""
                        }`}
                        onClick={() => selectScene(index)}
                        aria-label={`Go to presentation scene ${
                          index + 1
                        }`}
                      >
                        <span />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="presentation-control"
                    onClick={nextScene}
                    aria-label="Next presentation"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-scroll-hint">
            <span className="scroll-mouse">
              <span />
            </span>

            <span>Scroll to explore FreshGuard</span>

            <span className="scroll-arrow">↓</span>
          </div>
        </div>
      </section>

      {/* ========================================================
          PLATFORM IMPORTANCE
      ======================================================== */}

      <section className="home-section platform-section" id="platform">
        <div className="section-background-shape section-shape-one" />
        <div className="section-background-shape section-shape-two" />

        <div className="home-section-container">
          <div className="section-heading centered-heading">
            <span className="section-eyebrow">
              SMART FOOD MANAGEMENT
            </span>

            <h2>
              Why is <span>FreshGuard</span> important?
            </h2>

            <p>
              Food freshness ko monitor karna sirf food ko fresh dekhne
              tak limited nahi hai. Freshness, shelf-life, storage aur
              spoilage intelligence better decisions lene mein help
              karti hai.
            </p>
          </div>

          <div className="platform-story-grid">
            <div className="platform-story-visual">
              <div className="food-orbit">
                <div className="food-orbit-ring orbit-ring-one" />
                <div className="food-orbit-ring orbit-ring-two" />
                <div className="food-orbit-ring orbit-ring-three" />

                <div className="orbit-food orbit-food-one">🍎</div>
                <div className="orbit-food orbit-food-two">🥦</div>
                <div className="orbit-food orbit-food-three">🥕</div>
                <div className="orbit-food orbit-food-four">🍊</div>

                <div className="food-orbit-center">
                  <span>AI</span>
                  <small>FRESHNESS</small>
                </div>
              </div>
            </div>

            <div className="platform-story-content">
              <div className="story-item">
                <span className="story-number">01</span>

                <div>
                  <h3>Reduce Food Waste</h3>
                  <p>
                    Food ki condition aur shelf-life ko samajhkar
                    better decisions lene mein platform help karta hai.
                  </p>
                </div>
              </div>

              <div className="story-item">
                <span className="story-number">02</span>

                <div>
                  <h3>Improve Food Management</h3>
                  <p>
                    Food inventory, freshness aur storage information
                    ko ek intelligent platform par manage kijiye.
                  </p>
                </div>
              </div>

              <div className="story-item">
                <span className="story-number">03</span>

                <div>
                  <h3>Make Better Decisions</h3>
                  <p>
                    AI-powered insights food handling aur management
                    decisions ko smarter banane mein support karte hain.
                  </p>
                </div>
              </div>

              <div className="story-item">
                <span className="story-number">04</span>

                <div>
                  <h3>One Platform for Every Role</h3>
                  <p>
                    Consumer, Retail, Warehouse, Inspector aur
                    Administrator ke liye dedicated experiences.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          FEATURE SECTION
      ======================================================== */}

      <section className="home-section features-section" id="features">
        <div className="home-section-container">
          <div className="section-heading centered-heading">
            <span className="section-eyebrow">
              INTELLIGENT FOOD TECHNOLOGY
            </span>

            <h2>
              Everything you need to understand
              <span> food freshness.</span>
            </h2>

            <p>
              FreshGuard multiple intelligence layers ko combine karke
              food freshness monitoring ko simple aur useful banata hai.
            </p>
          </div>

          <div className="intelligence-feature-grid">
            {platformFeatures.map((feature, index) => (
              <article
                className="intelligence-feature-card"
                key={feature.title}
                style={{
                  "--feature-delay": `${index * 80}ms`,
                }}
              >
                <div className="intelligence-feature-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="intelligence-feature-icon">
                  {feature.icon}
                </div>

                <h3>{feature.title}</h3>

                <p>{feature.text}</p>

                <div className="feature-card-arrow">↗</div>

                <div className="feature-card-glow" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          HOW IT WORKS
      ======================================================== */}

      <section
        className="home-section how-it-works-section"
        id="how-it-works"
      >
        <div className="how-it-works-background" />

        <div className="home-section-container">
          <div className="section-heading centered-heading">
            <span className="section-eyebrow">
              SIMPLE • INTELLIGENT • CONNECTED
            </span>

            <h2>
              From food image to
              <span> actionable intelligence.</span>
            </h2>

            <p>
              FreshGuard ka workflow simple steps mein food information
              ko useful freshness intelligence mein transform karta hai.
            </p>
          </div>

          <div className="workflow-timeline">
            <div className="workflow-line">
              <span className="workflow-line-progress" />
            </div>

            <div className="workflow-step">
              <div className="workflow-step-number">01</div>

              <div className="workflow-step-visual">
                <div className="workflow-step-icon">🍎</div>
              </div>

              <div className="workflow-step-content">
                <span>INPUT</span>
                <h3>Add Food</h3>
                <p>
                  Food item aur required information platform mein add
                  kijiye.
                </p>
              </div>
            </div>

            <div className="workflow-step">
              <div className="workflow-step-number">02</div>

              <div className="workflow-step-visual">
                <div className="workflow-step-icon">🤖</div>
              </div>

              <div className="workflow-step-content">
                <span>ANALYSIS</span>
                <h3>AI Analysis</h3>
                <p>
                  AI aur Computer Vision food ki condition ko analyze
                  karte hain.
                </p>
              </div>
            </div>

            <div className="workflow-step">
              <div className="workflow-step-number">03</div>

              <div className="workflow-step-visual">
                <div className="workflow-step-icon">📊</div>
              </div>

              <div className="workflow-step-content">
                <span>INTELLIGENCE</span>
                <h3>Freshness Report</h3>
                <p>
                  Food freshness aur condition ki useful information
                  report mein dekhiye.
                </p>
              </div>
            </div>

            <div className="workflow-step">
              <div className="workflow-step-number">04</div>

              <div className="workflow-step-visual">
                <div className="workflow-step-icon">💡</div>
              </div>

              <div className="workflow-step-content">
                <span>ACTION</span>
                <h3>Smart Recommendation</h3>
                <p>
                  Food management aur storage ke liye better action
                  decisions lijiye.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          ROLE DASHBOARDS
      ======================================================== */}

      <section className="home-section roles-section" id="roles">
        <div className="home-section-container">
          <div className="section-heading centered-heading">
            <span className="section-eyebrow">
              ROLE-BASED EXPERIENCE
            </span>

            <h2>
              One platform.
              <span> Five powerful experiences.</span>
            </h2>

            <p>
              Har user role ko uske workflow aur responsibilities ke
              according dedicated intelligence aur dashboard experience.
            </p>
          </div>

          <div className="roles-experience">
            <div className="roles-sidebar">
              {roleFeatures.map((role, index) => (
                <button
                  type="button"
                  key={role.key}
                  className={`role-selector ${
                    activeRole === index ? "active" : ""
                  }`}
                  onClick={() => setActiveRole(index)}
                >
                  <span className="role-selector-icon">
                    {role.icon}
                  </span>

                  <span className="role-selector-text">
                    <strong>{role.name}</strong>
                    <small>Dashboard</small>
                  </span>

                  <span className="role-selector-arrow">→</span>
                </button>
              ))}
            </div>

            <div
              className={`role-dashboard-preview ${activeRoleData.colorClass}`}
              key={activeRoleData.key}
            >
              <div className="dashboard-preview-header">
                <div className="dashboard-preview-user">
                  <div className="dashboard-preview-avatar">
                    {activeRoleData.icon}
                  </div>

                  <div>
                    <span>FRESHGUARD DASHBOARD</span>
                    <h3>{activeRoleData.name}</h3>
                  </div>
                </div>

                <div className="dashboard-preview-live">
                  <span />
                  Smart Monitoring
                </div>
              </div>

              <div className="dashboard-preview-body">
                <div className="dashboard-preview-summary">
                  <div className="preview-summary-card">
                    <span>Food Health</span>
                    <strong>AI</strong>
                    <small>Intelligence</small>
                  </div>

                  <div className="preview-summary-card">
                    <span>Freshness</span>
                    <strong>Live</strong>
                    <small>Monitoring</small>
                  </div>

                  <div className="preview-summary-card">
                    <span>Insights</span>
                    <strong>Smart</strong>
                    <small>Recommendations</small>
                  </div>
                </div>

                <div className="dashboard-feature-preview-grid">
                  {activeRoleData.features.map((feature, index) => (
                    <div
                      className="dashboard-feature-preview"
                      key={feature.title}
                      style={{
                        "--preview-delay": `${index * 120}ms`,
                      }}
                    >
                      <div className="dashboard-feature-preview-icon">
                        {feature.icon}
                      </div>

                      <div>
                        <h4>{feature.title}</h4>
                        <p>{feature.text}</p>
                      </div>

                      <span>↗</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          AI SHOWCASE
      ======================================================== */}

      <section className="home-section ai-showcase-section">
        <div className="ai-showcase-grid-background" />

        <div className="home-section-container">
          <div className="ai-showcase-layout">
            <div className="ai-showcase-copy">
              <span className="section-eyebrow">
                AI + COMPUTER VISION
              </span>

              <h2>
                Let AI help you
                <span> understand your food.</span>
              </h2>

              <p>
                FreshGuard food images aur available food information
                ko use karke freshness intelligence provide karne ke
                liye designed hai.
              </p>

              <div className="ai-showcase-points">
                <div>
                  <span>✓</span>
                  <strong>Visual Food Analysis</strong>
                </div>

                <div>
                  <span>✓</span>
                  <strong>Freshness Intelligence</strong>
                </div>

                <div>
                  <span>✓</span>
                  <strong>Spoilage Indicators</strong>
                </div>

                <div>
                  <span>✓</span>
                  <strong>Actionable Recommendations</strong>
                </div>
              </div>

              <button
                type="button"
                className="showcase-cta-button"
                onClick={goToRegister}
              >
                <span>Start Exploring</span>
                <span>→</span>
              </button>
            </div>

            <div className="ai-showcase-visual">
              <div className="ai-scanner-card">
                <div className="scanner-card-header">
                  <span>
                    <i />
                    AI FOOD SCANNER
                  </span>

                  <span>LIVE</span>
                </div>

                <div className="scanner-food-stage">
                  <div className="scanner-grid-lines" />

                  <div className="scanner-food">
                    🍎
                  </div>

                  <div className="scanner-box scanner-box-one">
                    <span>COLOR</span>
                    <strong>ANALYSIS</strong>
                  </div>

                  <div className="scanner-box scanner-box-two">
                    <span>VISUAL</span>
                    <strong>CONDITION</strong>
                  </div>

                  <div className="scanner-line" />

                  <div className="scanner-scan-label">
                    <span className="scanner-pulse" />
                    ANALYZING FOOD
                  </div>
                </div>

                <div className="scanner-results">
                  <div>
                    <span>AI STATUS</span>
                    <strong>Analyzing</strong>
                  </div>

                  <div>
                    <span>VISION</span>
                    <strong>Active</strong>
                  </div>

                  <div>
                    <span>INTELLIGENCE</span>
                    <strong>Ready</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          FINAL CTA
      ======================================================== */}

      <section className="home-section final-cta-section">
        <div className="final-cta-orb final-cta-orb-one" />
        <div className="final-cta-orb final-cta-orb-two" />

        <div className="home-section-container">
          <div className="final-cta-card">
            <div className="final-cta-robot">
              <div className="mini-robot">
                <div className="mini-robot-head">
                  <span className="mini-robot-eye" />
                  <span className="mini-robot-eye" />
                </div>

                <div className="mini-robot-body">
                  <span>FG</span>
                </div>
              </div>
            </div>

            <div className="final-cta-content">
              <span className="section-eyebrow">
                WELCOME TO FRESHGUARD
              </span>

              <h2>
                Ready to make food management
                <span> smarter?</span>
              </h2>

              <p>
                Login karke apna dashboard use kijiye ya ek new account
                create karke FreshGuard ki complete food intelligence
                explore kijiye.
              </p>

              <div className="final-cta-actions">
                <button
                  type="button"
                  className="primary-action-button"
                  onClick={goToLogin}
                >
                  <span>Login to FreshGuard</span>
                  <span>→</span>
                </button>

                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={goToRegister}
                >
                  <span>Create Free Account</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          FOOTER
      ======================================================== */}

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="footer-brand-area">
            <button
              type="button"
              className="home-brand footer-brand"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                })
              }
            >
              <span className="home-brand-mark">
                <span>F</span>
                <span>G</span>
              </span>

              <span className="home-brand-text">
                <strong>FreshGuard</strong>
                <small>AI Food Intelligence</small>
              </span>
            </button>

            <p>
              Intelligent food freshness monitoring, shelf-life,
              storage intelligence and smart recommendations.
            </p>
          </div>

          <div className="footer-links">
            <div>
              <span>EXPLORE</span>

              <button
                type="button"
                onClick={() => scrollToSection("platform")}
              >
                Platform
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("features")}
              >
                Features
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("roles")}
              >
                Roles
              </button>
            </div>

            <div>
              <span>ACCOUNT</span>

              <button type="button" onClick={goToLogin}>
                Login
              </button>

              <button type="button" onClick={goToRegister}>
                Create Account
              </button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} FreshGuard. AI Food Freshness
            Monitoring Platform.
          </span>

          <span>Built for smarter food management.</span>
        </div>
      </footer>
    </main>
  );
}

export default Home;