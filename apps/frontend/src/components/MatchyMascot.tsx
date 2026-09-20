interface MatchyMascotProps {
  pose?: "profile" | "missions" | "dashboard";
  className?: string;
  size?: number;
  includeBackground?: boolean;
}

export function MatchyMascot({
  pose = "profile",
  className = "",
  size = 220,
  includeBackground = false,
}: MatchyMascotProps) {
  // Ratio is approximately 1:1 or slightly taller for profile, banner-fitted for missions
  const viewBox =
    pose === "missions"
      ? "0 0 320 280"
      : pose === "dashboard"
        ? "0 0 280 320"
        : "0 0 280 320";

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`matchy-mascot ${className}`}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {/* Background botanical foliage */}
      {includeBackground && (
        <g opacity={pose === "profile" ? "0.35" : "0.22"}>
          <path
            d="M260 80C285 110 290 160 270 200C250 240 210 260 170 270C200 240 225 190 220 150C215 110 235 90 260 80Z"
            fill={pose === "profile" ? "#6BA292" : "#98C9A3"}
          />
          <path
            d="M30 160C10 200 15 245 40 275C20 250 15 210 25 180C35 150 25 140 30 160Z"
            fill={pose === "profile" ? "#6BA292" : "#98C9A3"}
          />
          <path
            d="M230 40C250 60 265 95 250 120C235 145 205 155 185 160C205 140 220 115 215 90C210 65 215 50 230 40Z"
            fill={pose === "profile" ? "#7EB2A2" : "#B5E2C4"}
          />
        </g>
      )}

      {/* MATCHY: Head, Chef Hat, Face, Hair, Body */}
      <g id="matchy-character">
        {/* Chef Toque (Hat) */}
        <g id="chef-hat">
          {/* Hat shadow under folds */}
          <path
            d="M75 110C65 85 85 45 125 45C135 35 160 30 180 42C205 32 235 50 230 90C245 105 235 125 215 125L85 125C75 125 70 118 75 110Z"
            fill="#F3F4F6"
          />
          {/* Hat folds (white puffs) */}
          <path
            d="M80 112C70 90 85 52 120 50C130 38 158 32 178 44C200 35 228 52 225 88C238 102 230 122 212 122L88 122C78 122 75 118 80 112Z"
            fill="#FFFFFF"
            stroke="#17211C"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Folds interior crease lines */}
          <path
            d="M118 52C122 75 120 100 115 120M172 45C170 70 172 95 178 120M212 85C205 98 198 112 195 120"
            stroke="#E5E7EB"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Hat brim / headband */}
          <rect
            x="85"
            y="118"
            width="130"
            height="18"
            rx="5"
            fill="#FFFFFF"
            stroke="#17211C"
            strokeWidth="3.5"
          />
        </g>

        {/* Hair under hat */}
        <path
          d="M86 134C86 134 95 148 110 148C125 148 135 138 150 142C165 146 175 140 185 148C195 152 205 142 214 134C216 145 214 158 208 168C206 170 200 178 198 180C190 170 188 160 188 160C188 160 180 175 160 175C140 175 130 162 130 162C130 162 122 172 108 172C98 172 90 162 90 152C88 145 86 138 86 134Z"
          fill="#17211C"
        />

        {/* Head / Face */}
        <path
          d="M92 145C92 135 105 130 150 130C195 130 208 135 208 145C215 165 214 195 198 212C182 228 165 232 150 232C135 232 118 228 102 212C86 195 85 165 92 145Z"
          fill="#FFE7DC"
          stroke="#17211C"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Ears */}
        <ellipse
          cx="88"
          cy="175"
          rx="7"
          ry="10"
          fill="#FFE7DC"
          stroke="#17211C"
          strokeWidth="3"
        />
        <ellipse
          cx="212"
          cy="175"
          rx="7"
          ry="10"
          fill="#FFE7DC"
          stroke="#17211C"
          strokeWidth="3"
        />

        {/* Rosy Cheeks */}
        <ellipse cx="112" cy="188" rx="9" ry="6" fill="#FFAAA0" opacity="0.8" />
        <ellipse cx="188" cy="188" rx="9" ry="6" fill="#FFAAA0" opacity="0.8" />

        {/* Eyebrows */}
        <path
          d="M115 160C122 156 130 158 132 160"
          stroke="#17211C"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M168 160C170 158 178 156 185 160"
          stroke="#17211C"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Happy Arc Eyes */}
        <path
          d="M116 172C120 166 128 166 132 172"
          stroke="#17211C"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M168 172C172 166 180 166 184 172"
          stroke="#17211C"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Cute Nose */}
        <path
          d="M150 178C148 181 152 183 150 184"
          stroke="#E08B7B"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Smiling Mouth */}
        <path
          d="M138 194C144 204 156 204 162 194"
          stroke="#17211C"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="#C84630"
        />

        {/* Neck and White Chef Shirt Collar */}
        <path d="M136 228L130 248H170L164 228Z" fill="#FFE7DC" />
        <path
          d="M125 240L142 258L150 244L158 258L175 240L185 258L115 258Z"
          fill="#FFFFFF"
          stroke="#17211C"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Body & Green Apron */}
        <g id="body-apron">
          {/* Shirt shoulders */}
          <path
            d="M95 260C85 270 75 300 70 320H230C225 300 215 270 205 260Z"
            fill="#FFFFFF"
            stroke="#17211C"
            strokeWidth="3.5"
          />
          {/* Green Apron Bib */}
          <path
            d="M110 252L102 320H198L190 252C190 252 160 255 150 255C140 255 110 252 110 252Z"
            fill="#0C3B2E"
            stroke="#17211C"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Apron Straps */}
          <path
            d="M112 252L96 238M188 252L204 238"
            stroke="#17211C"
            strokeWidth="3"
          />
        </g>

        {/* Pose Specific Elements */}
        {pose === "profile" && (
          <g id="pose-profile">
            {/* Left Arm holding clipboard */}
            <g id="clipboard-arm">
              {/* Clipboard backing (dark wood/cardboard) */}
              <rect
                x="55"
                y="210"
                width="42"
                height="65"
                rx="4"
                transform="rotate(8 55 210)"
                fill="#3A2D28"
                stroke="#17211C"
                strokeWidth="2.5"
              />
              {/* White paper */}
              <rect
                x="59"
                y="218"
                width="34"
                height="52"
                rx="2"
                transform="rotate(8 59 218)"
                fill="#FFFFFF"
              />
              {/* Paper clip at top */}
              <rect
                x="70"
                y="208"
                width="16"
                height="7"
                rx="2"
                transform="rotate(8 70 208)"
                fill="#94A3B8"
                stroke="#17211C"
                strokeWidth="2"
              />
              {/* Text lines on paper */}
              <line
                x1="66"
                y1="234"
                x2="88"
                y2="237"
                stroke="#CBD5E1"
                strokeWidth="2"
              />
              <line
                x1="67"
                y1="244"
                x2="89"
                y2="247"
                stroke="#CBD5E1"
                strokeWidth="2"
              />
              <line
                x1="68"
                y1="254"
                x2="85"
                y2="256"
                stroke="#CBD5E1"
                strokeWidth="2"
              />
              {/* Arm/Hand holding clipboard */}
              <path
                d="M90 248C80 250 68 255 72 272C76 280 88 275 96 265Z"
                fill="#FFE7DC"
                stroke="#17211C"
                strokeWidth="3"
              />
            </g>

            {/* Right Arm: Thumbs Up */}
            <g id="thumbs-up-arm">
              {/* Arm sleeve */}
              <path
                d="M204 260C215 250 230 230 234 205"
                stroke="#17211C"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M204 260C215 250 230 230 234 205"
                stroke="#FFFFFF"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Hand with thumbs up */}
              <g transform="translate(226, 185)">
                {/* Thumb pointing up */}
                <path
                  d="M10 20C8 12 11 0 16 0C20 0 20 8 18 18L18 24"
                  fill="#FFE7DC"
                  stroke="#17211C"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {/* Fist knuckles */}
                <path
                  d="M10 18C4 18 2 24 2 30C2 36 8 38 15 38C22 38 24 32 24 26L20 18Z"
                  fill="#FFE7DC"
                  stroke="#17211C"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </g>
              {/* Orange energy / excitement accents above thumb */}
              <path
                d="M245 168L252 160M255 178L265 174"
                stroke="#E05626"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </g>
          </g>
        )}

        {(pose === "missions" || pose === "dashboard") && (
          <g id="pose-cloche-missions">
            {/* Cloche platter on left */}
            <g id="serving-cloche" transform="translate(45, 175)">
              {/* Platter base */}
              <ellipse
                cx="60"
                cy="55"
                rx="55"
                ry="7"
                fill="#E2E8F0"
                stroke="#17211C"
                strokeWidth="3"
              />
              {/* Cloche dome */}
              <path
                d="M15 55C15 25 35 15 60 15C85 15 105 25 105 55Z"
                fill="#F1F5F9"
                stroke="#17211C"
                strokeWidth="3"
              />
              {/* Dome highlight */}
              <path
                d="M30 48C30 32 42 22 60 22"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Cloche handle ring */}
              <circle
                cx="60"
                cy="11"
                r="5"
                fill="#CBD5E1"
                stroke="#17211C"
                strokeWidth="2.5"
              />
              {/* Steam / sparkles above cloche */}
              <path
                d="M50 4C52 -2 48 -6 50 -10M65 3C63 -1 66 -5 64 -9"
                stroke="#94A3B8"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Hand holding cloche platter */}
              <ellipse
                cx="60"
                cy="58"
                rx="14"
                ry="7"
                fill="#FFE7DC"
                stroke="#17211C"
                strokeWidth="2.5"
              />
            </g>

            {pose === "missions" ? (
              /* Magnifying glass in right hand */
              <g id="magnifying-glass" transform="translate(225, 175)">
                {/* Arm */}
                <path
                  d="M-20 85C-5 65 15 50 25 35"
                  stroke="#FFFFFF"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Hand */}
                <circle
                  cx="22"
                  cy="30"
                  r="10"
                  fill="#FFE7DC"
                  stroke="#17211C"
                  strokeWidth="3"
                />
                {/* Lens Glass */}
                <circle
                  cx="28"
                  cy="-5"
                  r="28"
                  fill="#E0F2FE"
                  fillOpacity="0.75"
                  stroke="#17211C"
                  strokeWidth="4"
                />
                {/* Lens Highlight reflection */}
                <path
                  d="M12 -18C18 -26 34 -28 44 -18"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Handle */}
                <path
                  d="M20 18L10 42"
                  stroke="#17211C"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Orange sparkles above magnifying glass */}
                <path
                  d="M48 -35L54 -42M58 -22L66 -26"
                  stroke="#E05626"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              /* Dashboard welcoming right hand */
              <g id="welcoming-hand">
                <path
                  d="M200 250C215 255 225 265 230 280"
                  stroke="#FFFFFF"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <ellipse
                  cx="232"
                  cy="282"
                  rx="10"
                  ry="8"
                  fill="#FFE7DC"
                  stroke="#17211C"
                  strokeWidth="2.5"
                />
              </g>
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
